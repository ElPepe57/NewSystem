"""
Genera PDF del Informe 4-Way Cross-Reference de Reconciliacion MercadoPago.
Lee datos desde informe-4way-data.json (generado por informe-4way-reconciliacion.mjs).

Usage: python scripts/generar-pdf-reconciliacion.py
"""
import json
import os
from datetime import datetime

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Load data ──
data_path = os.path.join(os.path.dirname(__file__), 'informe-4way-data.json')
with open(data_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

output_path = os.path.join(os.path.dirname(__file__), '..', 'Informe_Reconciliacion_MP_v3.pdf')

# ── RECALCULATE inconsistencies with corrected Flex bonificacion formula ──
# ML API net_received does NOT include Flex bonificacion. Real deposit = net_received + bonificacion.
def recalculate_inconsistencies(data):
    """Fix DISC_VS_ML_API: for Flex, real deposit = net_received + costoEnvioCliente"""
    for v in data.get('ventasDetalle', []):
        net_received = v.get('mlApiNetReceived', 0)
        costo_envio_cliente = v.get('mlErpCostoEnvioCliente', 0)
        metodo = v.get('mlErpMetodoEnvio', '?')
        bonificacion = costo_envio_cliente if metodo == 'flex' else 0
        real_deposit = round(net_received + bonificacion, 2)
        v['mlRealDeposit'] = real_deposit

        # Recalculate DISC_VS_ML_API
        sys_net = v.get('sysNet', 0)
        new_incs = []
        for inc in v.get('inconsistencias', []):
            if inc['tipo'] == 'DISC_VS_ML_API':
                disc = round(sys_net - real_deposit, 2)
                if abs(disc) > 0.50:
                    bonif_str = f" = net S/ {net_received:.2f} + bonif S/ {bonificacion:.2f}" if bonificacion > 0 else ""
                    inc['descripcion'] = f"Sistema NET (S/ {sys_net:.2f}) != ML deposito real (S/ {real_deposit:.2f}{bonif_str}) -> diff {'+'if disc>0 else ''}{disc:.2f}"
                    inc['impacto'] = disc
                    new_incs.append(inc)
                # else: disc resolved, skip this inconsistency
            elif inc['tipo'] == 'MISSING_CARGO':
                # For Urbano orders, delivery gastos often ARE the cargo envio
                cargo = v.get('mlErpCargoEnvio', 0)
                delivery_total = sum(
                    e.get('monto', 0) for e in v.get('sysEgresosDetail', [])
                    if 'delivery' in (e.get('gastoTipo', '') or '') or 'entrega' in (e.get('concepto', '') or '').lower()
                )
                if delivery_total >= cargo - 1:
                    pass  # delivery covers cargo, skip this inconsistency
                else:
                    new_incs.append(inc)
            else:
                new_incs.append(inc)
        v['inconsistencias'] = new_incs

    # Rebuild summary
    by_tipo = {}
    total_pos = 0
    total_neg = 0
    for v in data.get('ventasDetalle', []):
        for inc in v.get('inconsistencias', []):
            tipo = inc['tipo']
            if tipo not in by_tipo:
                by_tipo[tipo] = {'tipo': tipo, 'count': 0, 'totalImpacto': 0, 'ventas': []}
            by_tipo[tipo]['count'] += 1
            by_tipo[tipo]['totalImpacto'] += inc.get('impacto', 0)
            by_tipo[tipo]['ventas'].append(v.get('numVenta', '?'))
            if inc.get('impacto', 0) > 0:
                total_pos += inc['impacto']
            else:
                total_neg += inc['impacto']
    data['summary'] = list(by_tipo.values())
    data['totalImpacto'] = round(total_pos + total_neg + data.get('orphanIngresosTotal', 0), 2)

    # Separate ventas with vs without issues
    ventas_with = [v for v in data.get('ventasDetalle', []) if v.get('inconsistencias')]
    ventas_without_nums = [v['numVenta'] for v in data.get('ventasDetalle', []) if not v.get('inconsistencias')]
    data['ventasDetalle'] = ventas_with
    data['ventasConInconsistencias'] = len(ventas_with)
    # Add resolved ventas to OK list
    ok_list = data.get('ventasOKList', [])
    for n in ventas_without_nums:
        if n not in ok_list:
            ok_list.append(n)
    data['ventasOKList'] = sorted(ok_list)
    data['ventasOK'] = len(ok_list)

    # Rebuild corrections (skip DISC_VS_ML_API, keep others)
    corrections = []
    for v in data.get('ventasDetalle', []):
        for inc in v.get('inconsistencias', []):
            if inc.get('impacto', 0) == 0 and inc['tipo'] != 'GASTO_MONTO_ZERO':
                continue
            if inc['tipo'] == 'DISC_VS_ML_API':
                continue  # overlaps with specific types
            correccion = ''
            accion = ''
            imp = inc.get('impacto', 0)
            if inc['tipo'] == 'DISC_INGRESO':
                metodo = v.get('mlErpMetodoEnvio', '?')
                deposit = v.get('mlErpDeposit', 0)
                sys_in = v.get('sysIngresos', 0)
                first_mov = v.get('sysIngresosDetail', [{}])[0] if v.get('sysIngresosDetail') else {}
                if metodo == 'urbano' and imp > 0:
                    correccion = f"Reducir ingreso de S/ {sys_in:.2f} a S/ {deposit:.2f}"
                elif metodo == 'flex' and imp < 0:
                    correccion = f"Aumentar ingreso de S/ {sys_in:.2f} a S/ {deposit:.2f} (bonificacion envio)"
                else:
                    correccion = f"Ajustar ingreso de S/ {sys_in:.2f} a S/ {deposit:.2f}"
                accion = f"Editar mov {first_mov.get('num', '?')}: monto -> S/ {deposit:.2f}"
            elif inc['tipo'] == 'MISSING_CARGO':
                cargo = v.get('mlErpCargoEnvio', 0)
                correccion = f"Crear gasto cargo envio ML + egreso S/ {cargo:.2f}"
                accion = f"Crear gasto tipo=cargo_envio_ml, ventaId={v.get('ventaId','?')}"
            elif inc['tipo'] == 'DISC_COMISION':
                com = v.get('mlErpComision', 0)
                correccion = f"Crear gasto comision ML + egreso S/ {com:.2f}"
                accion = f"Crear gasto tipo=comision_ml, ventaId={v.get('ventaId','?')}"
            elif inc['tipo'] == 'MULTIPLE_INGRESOS':
                correccion = "Revisar multiples ingresos - posible duplicado"
                accion = "Revision manual"
            else:
                correccion = inc.get('descripcion', '')
                accion = 'Revision manual'
            corrections.append({
                'venta': v.get('numVenta', '?'),
                'tipo': inc['tipo'],
                'correccion': correccion,
                'accion': accion,
                'impacto': imp,
            })

    # Add orphan corrections
    for o in data.get('orphanMovs', []):
        corrections.append({
            'venta': 'HUERFANO',
            'tipo': 'ORPHAN',
            'correccion': f"Mov {o.get('num','?')} ({'+' if o.get('efecto',0)>=0 else ''}{o.get('efecto',0):.2f}) - vincular o anular",
            'accion': f"Anular mov {o.get('id','?')} si no corresponde",
            'impacto': abs(o.get('efecto', 0)),
        })

    data['corrections'] = corrections

    # Recalculate projection
    total_corr = sum(c.get('impacto', 0) for c in corrections)
    saldo_sis = data.get('overview', {}).get('saldoSistema', 0)
    saldo_real = data.get('overview', {}).get('saldoReal', 0)
    projected = round(saldo_sis - total_corr, 2)
    data['projection'] = {
        'saldoActual': saldo_sis,
        'totalCorrecciones': round(total_corr, 2),
        'saldoProyectado': projected,
        'saldoReal': saldo_real,
        'gapResidual': round(projected - saldo_real, 2),
    }

recalculate_inconsistencies(data)

# ── Styles ──
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    'ReportTitle', parent=styles['Title'],
    fontSize=18, leading=22, textColor=colors.HexColor('#1a237e'),
    spaceAfter=6
))
styles.add(ParagraphStyle(
    'ReportSubtitle', parent=styles['Normal'],
    fontSize=11, leading=14, textColor=colors.HexColor('#546e7a'),
    spaceAfter=12
))
styles.add(ParagraphStyle(
    'SectionHeader', parent=styles['Heading1'],
    fontSize=14, leading=18, textColor=colors.HexColor('#1565c0'),
    spaceBefore=16, spaceAfter=8,
    borderWidth=1, borderColor=colors.HexColor('#1565c0'),
    borderPadding=4
))
styles.add(ParagraphStyle(
    'SubSection', parent=styles['Heading2'],
    fontSize=11, leading=14, textColor=colors.HexColor('#37474f'),
    spaceBefore=10, spaceAfter=4
))
styles.add(ParagraphStyle(
    'SmallText', parent=styles['Normal'],
    fontSize=7.5, leading=9.5
))
styles.add(ParagraphStyle(
    'SmallBold', parent=styles['Normal'],
    fontSize=7.5, leading=9.5, fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'VentaTitle', parent=styles['Normal'],
    fontSize=10, leading=13, fontName='Helvetica-Bold',
    textColor=colors.HexColor('#0d47a1'), spaceBefore=8, spaceAfter=4
))
styles.add(ParagraphStyle(
    'CellText', parent=styles['Normal'],
    fontSize=7, leading=9
))
styles.add(ParagraphStyle(
    'CellBold', parent=styles['Normal'],
    fontSize=7, leading=9, fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'FooterText', parent=styles['Normal'],
    fontSize=7, leading=9, textColor=colors.grey
))
styles.add(ParagraphStyle(
    'CorreccionText', parent=styles['Normal'],
    fontSize=7.5, leading=10
))
styles.add(ParagraphStyle(
    'MontoPositivo', parent=styles['Normal'],
    fontSize=7.5, leading=9.5, textColor=colors.HexColor('#c62828')
))
styles.add(ParagraphStyle(
    'MontoNegativo', parent=styles['Normal'],
    fontSize=7.5, leading=9.5, textColor=colors.HexColor('#2e7d32')
))

def fmt(n):
    return f"S/ {n:,.2f}"

def fmt_impacto(n):
    if n > 0:
        return f"+{fmt(n)}"
    return fmt(n)

def build_panorama_table(overview):
    """Section 1: General overview table"""
    data_rows = [
        ['Concepto', 'Monto', 'Detalle'],
        ['Ingresos totales a MP', fmt(overview['totalIngresos']), f"{overview['countIngresos']} movimientos"],
        ['Egresos totales de MP', fmt(overview['totalEgresos']), f"{overview['countEgresos']} movimientos"],
        ['  Comisiones', fmt(overview['egresoComisiones']), ''],
        ['  Cargo envio', fmt(overview['egresoCargoEnvio']), ''],
        ['  Delivery', fmt(overview['egresoDelivery']), ''],
        ['  Transferencias a banco', fmt(overview['egresoTransferencias']), ''],
        ['  Otros', fmt(overview['egresoOtros']), ''],
        ['', '', ''],
        ['SALDO SISTEMA (calculado)', fmt(overview['saldoSistema']), ''],
        ['SALDO REAL MP', fmt(overview['saldoReal']), ''],
        ['GAP (sistema - real)', fmt(overview['gap']), 'Sistema registra de mas'],
    ]

    t = Table(data_rows, colWidths=[200, 120, 160])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1565c0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#e3f2fd')),
        ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#e8f5e9')),
        ('BACKGROUND', (0, 11), (-1, 11), colors.HexColor('#ffebee')),
        ('FONTNAME', (0, 9), (-1, 11), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def build_venta_block(v):
    """Build a block for a single venta with inconsistencies"""
    elements = []

    envio_label = v.get('mlErpMetodoEnvio', '?')
    header = f"{v['numVenta']}  |  {envio_label}  |  {v.get('syncCount', 0)} syncs  |  Estado: {v.get('ventaEstadoPago', '?')}"
    elements.append(Paragraph(header, styles['VentaTitle']))

    # 4-source comparison table
    rows = [
        [Paragraph('<b>Fuente</b>', styles['CellBold']),
         Paragraph('<b>Concepto</b>', styles['CellBold']),
         Paragraph('<b>Monto</b>', styles['CellBold'])],
    ]

    # Source 1: ML API
    real_deposit = v.get('mlRealDeposit', v.get('mlApiNetReceived', 0))
    rows.append([
        Paragraph('ML API (real)', styles['CellBold']),
        Paragraph(f"deposito real (net + bonif)", styles['CellText']),
        Paragraph(fmt(real_deposit), styles['CellText']),
    ])
    for p in v.get('mlApiPayments', []):
        rows.append([
            Paragraph('', styles['CellText']),
            Paragraph(f"payment {p['paymentId']}: txn={fmt(p['transactionAmount'])}", styles['CellText']),
            Paragraph(f"net={fmt(p['net'])}", styles['CellText']),
        ])

    # Source 2: ML ERP
    rows.append([
        Paragraph('ML ERP (sync)', styles['CellBold']),
        Paragraph(f"totalML={fmt(v.get('mlErpTotalML', 0))} com={fmt(v.get('mlErpComision', 0))} cargo={fmt(v.get('mlErpCargoEnvio', 0))} envCli={fmt(v.get('mlErpCostoEnvioCliente', 0))}", styles['CellText']),
        Paragraph(f"NET={fmt(v.get('mlErpNet', 0))}", styles['CellText']),
    ])

    # Source 3: Venta ERP
    rows.append([
        Paragraph('Venta ERP', styles['CellBold']),
        Paragraph(f"totalPEN", styles['CellText']),
        Paragraph(fmt(v.get('ventaTotalPEN', 0)), styles['CellText']),
    ])

    # Source 4: Tesoreria
    rows.append([
        Paragraph('Tesoreria', styles['CellBold']),
        Paragraph(f"Ingresos a MP", styles['CellText']),
        Paragraph(fmt(v.get('sysIngresos', 0)), styles['CellText']),
    ])
    for ing in v.get('sysIngresosDetail', []):
        rows.append([
            Paragraph('', styles['CellText']),
            Paragraph(f"  {ing.get('num', '?')} [{ing.get('via', '')}] {(ing.get('concepto', '') or '')[:45]}", styles['CellText']),
            Paragraph(fmt(ing.get('monto', 0)), styles['CellText']),
        ])
    rows.append([
        Paragraph('', styles['CellText']),
        Paragraph('Egresos de MP', styles['CellText']),
        Paragraph(fmt(v.get('sysEgresos', 0)), styles['CellText']),
    ])
    for eg in v.get('sysEgresosDetail', []):
        rows.append([
            Paragraph('', styles['CellText']),
            Paragraph(f"  {eg.get('num', '?')} [{eg.get('via', '')}] {(eg.get('concepto', '') or '')[:45]}", styles['CellText']),
            Paragraph(fmt(eg.get('monto', 0)), styles['CellText']),
        ])
    rows.append([
        Paragraph('', styles['CellBold']),
        Paragraph('NET sistema', styles['CellBold']),
        Paragraph(fmt(v.get('sysNet', 0)), styles['CellBold']),
    ])

    t = Table(rows, colWidths=[80, 310, 90])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#37474f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e0e0e0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fff3e0')),
    ]))
    elements.append(t)

    # Inconsistencies
    if v.get('inconsistencias'):
        elements.append(Spacer(1, 4))
        for inc in v['inconsistencias']:
            imp = inc.get('impacto', 0)
            if imp > 0:
                imp_str = f'<font color="#c62828">[+{fmt(imp)}]</font>'
            elif imp < 0:
                imp_str = f'<font color="#2e7d32">[{fmt(imp)}]</font>'
            else:
                imp_str = '<font color="#757575">[sin impacto]</font>'

            tipo_color = '#c62828' if imp > 0 else ('#2e7d32' if imp < 0 else '#616161')
            elements.append(Paragraph(
                f'<font color="{tipo_color}"><b>{inc["tipo"]}</b></font>: {inc["descripcion"]} {imp_str}',
                styles['SmallText']
            ))

    elements.append(Spacer(1, 6))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#bdbdbd')))

    return KeepTogether(elements)


def build_summary_table(summary):
    """Section 4: Summary of discrepancies by type"""
    rows = [
        [Paragraph('<b>Tipo</b>', styles['CellBold']),
         Paragraph('<b>#</b>', styles['CellBold']),
         Paragraph('<b>Impacto</b>', styles['CellBold']),
         Paragraph('<b>Ventas</b>', styles['CellBold'])],
    ]
    for item in summary:
        imp = item['totalImpacto']
        imp_str = f"+{fmt(imp)}" if imp >= 0 else fmt(imp)
        color = '#c62828' if imp > 0 else ('#2e7d32' if imp < 0 else '#616161')
        rows.append([
            Paragraph(item['tipo'], styles['CellText']),
            Paragraph(str(item['count']), styles['CellText']),
            Paragraph(f'<font color="{color}"><b>{imp_str}</b></font>', styles['CellText']),
            Paragraph(', '.join(item['ventas'][:10]) + ('...' if len(item['ventas']) > 10 else ''), styles['CellText']),
        ])

    t = Table(rows, colWidths=[120, 30, 80, 250])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1565c0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e0e0e0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def build_corrections_table(corrections):
    """Section 5: Specific corrections"""
    rows = [
        [Paragraph('<b>#</b>', styles['CellBold']),
         Paragraph('<b>Venta</b>', styles['CellBold']),
         Paragraph('<b>Tipo</b>', styles['CellBold']),
         Paragraph('<b>Correccion</b>', styles['CellBold']),
         Paragraph('<b>Impacto</b>', styles['CellBold'])],
    ]
    for i, c in enumerate(corrections, 1):
        imp = c.get('impacto', 0)
        imp_str = fmt_impacto(imp) if imp != 0 else '-'
        color = '#c62828' if imp > 0 else ('#2e7d32' if imp < 0 else '#616161')
        rows.append([
            Paragraph(str(i), styles['CellText']),
            Paragraph(c.get('venta', '?'), styles['CellText']),
            Paragraph(c.get('tipo', '?'), styles['CellText']),
            Paragraph(c.get('correccion', ''), styles['CellText']),
            Paragraph(f'<font color="{color}"><b>{imp_str}</b></font>', styles['CellText']),
        ])

    t = Table(rows, colWidths=[22, 70, 95, 240, 60])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1565c0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e0e0e0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
    ]))
    return t


# ── Build PDF ──
doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    leftMargin=0.6*inch, rightMargin=0.6*inch,
    topMargin=0.7*inch, bottomMargin=0.6*inch,
    title="Informe Reconciliacion MercadoPago",
    author="BusinessMN ERP"
)

story = []

# ── Title Page ──
story.append(Spacer(1, 60))
story.append(Paragraph("INFORME DE RECONCILIACION", styles['ReportTitle']))
story.append(Paragraph("MERCADOPAGO", styles['ReportTitle']))
story.append(Spacer(1, 12))
story.append(HRFlowable(width="80%", thickness=2, color=colors.HexColor('#1565c0')))
story.append(Spacer(1, 12))
story.append(Paragraph(
    "Cruce 4 fuentes: ML API x MercadoLibre ERP x Ventas ERP x Gastos/Tesoreria ERP",
    styles['ReportSubtitle']
))
story.append(Paragraph(f"Fecha: {data.get('fecha', '2026-03-14')}", styles['ReportSubtitle']))
story.append(Spacer(1, 30))

# Overview box
overview = data.get('overview', {})
story.append(build_panorama_table(overview))
story.append(Spacer(1, 20))

story.append(Paragraph(
    f"<b>Ventas con inconsistencias:</b> {data.get('ventasConInconsistencias', 0)}  |  "
    f"<b>Ventas OK:</b> {data.get('ventasOK', 0)}  |  "
    f"<b>Movimientos huerfanos:</b> {data.get('orphanCount', 0)}",
    styles['Normal']
))

story.append(PageBreak())

# ── Section 2: Per-venta details ──
story.append(Paragraph("SECCION 2: CRUCE 4 FUENTES POR VENTA", styles['SectionHeader']))
story.append(Paragraph(
    "Cada venta muestra las 4 fuentes de datos lado a lado. Solo se muestran ventas con inconsistencias.",
    styles['SmallText']
))
story.append(Spacer(1, 8))

ventas_con_issues = data.get('ventasDetalle', [])
for v in ventas_con_issues:
    story.append(build_venta_block(v))

# Ventas OK list
ventas_ok = data.get('ventasOKList', [])
if ventas_ok:
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"<b>Ventas OK (sin inconsistencias):</b> {', '.join(ventas_ok)}", styles['SmallText']))

story.append(PageBreak())

# ── Section 3: Orphan movements ──
story.append(Paragraph("SECCION 3: MOVIMIENTOS HUERFANOS", styles['SectionHeader']))
orphans = data.get('orphanMovs', [])
if orphans:
    orphan_rows = [
        [Paragraph('<b>Movimiento</b>', styles['CellBold']),
         Paragraph('<b>Efecto</b>', styles['CellBold']),
         Paragraph('<b>Concepto</b>', styles['CellBold'])],
    ]
    for o in orphans:
        ef = o.get('efecto', 0)
        sign = '+' if ef >= 0 else ''
        orphan_rows.append([
            Paragraph(o.get('num', 'N/A'), styles['CellText']),
            Paragraph(f"{sign}{fmt(ef)}", styles['CellText']),
            Paragraph((o.get('concepto', '') or '')[:60], styles['CellText']),
        ])
    ot = Table(orphan_rows, colWidths=[120, 100, 260])
    ot.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ff8f00')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e0e0e0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(ot)
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Total huerfanos ingreso: +{fmt(data.get('orphanIngresosTotal', 0))}", styles['SmallBold']))
else:
    story.append(Paragraph("(ninguno)", styles['SmallText']))

story.append(Spacer(1, 20))

# ── Section 4: Summary ──
story.append(Paragraph("SECCION 4: RESUMEN DE DISCREPANCIAS POR TIPO", styles['SectionHeader']))
summary = data.get('summary', [])
if summary:
    story.append(build_summary_table(summary))
story.append(Spacer(1, 10))
story.append(Paragraph(
    f"<b>Total impacto discrepancias:</b> {fmt_impacto(data.get('totalImpacto', 0))}  |  "
    f"<b>GAP real:</b> {fmt(overview.get('gap', 0))}",
    styles['Normal']
))

story.append(PageBreak())

# ── Section 5: Corrections ──
story.append(Paragraph("SECCION 5: LISTA DE CORRECCIONES ESPECIFICAS", styles['SectionHeader']))
story.append(Paragraph(
    "Cada correccion incluye el ID del documento afectado y la accion a realizar.",
    styles['SmallText']
))
story.append(Spacer(1, 6))

corrections = data.get('corrections', [])
if corrections:
    story.append(build_corrections_table(corrections))

story.append(Spacer(1, 14))

# ── Section 6: Projection ──
story.append(Paragraph("SECCION 6: PROYECCION POST-CORRECCIONES", styles['SectionHeader']))
proj = data.get('projection', {})
proj_rows = [
    ['Concepto', 'Monto'],
    ['Saldo sistema actual', fmt(proj.get('saldoActual', 0))],
    ['Total correcciones (impacto)', fmt_impacto(proj.get('totalCorrecciones', 0))],
    ['Saldo proyectado post-correccion', fmt(proj.get('saldoProyectado', 0))],
    ['Saldo real MP', fmt(proj.get('saldoReal', 0))],
    ['Gap residual proyectado', fmt(proj.get('gapResidual', 0))],
]
pt = Table(proj_rows, colWidths=[250, 130])
pt.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1565c0')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('LEADING', (0, 0), (-1, -1), 12),
    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#e3f2fd')),
    ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#fff3e0')),
    ('FONTNAME', (0, 3), (-1, 5), 'Helvetica-Bold'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(pt)

story.append(Spacer(1, 16))
story.append(Paragraph(
    f"<b>NOTA:</b> Despues de aplicar correcciones, ejecutar <font face='Courier'>recalcularSaldoCuenta('{data.get('mpAccountId', '')}')</font> "
    "para recalcular el campo saldoActual desde los movimientos.",
    styles['SmallText']
))

# Footer
story.append(Spacer(1, 30))
story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
story.append(Paragraph(
    f"Generado automaticamente por BusinessMN ERP - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
    styles['FooterText']
))

# ── Generate ──
doc.build(story)
print(f"PDF generado: {os.path.abspath(output_path)}")
