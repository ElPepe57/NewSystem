const movements = [
  { date: '26/01', type: 'Venta', account: 'MercadoPago', pen: 157, usd: 0 },
  { date: '26/01', type: 'Venta', account: 'MercadoPago', pen: 157, usd: 0 },
  { date: '26/01', type: 'Venta', account: 'MercadoPago', pen: 189, usd: 0 },
  { date: '26/01', type: 'Venta', account: 'BCP', pen: 140, usd: 0 },
  { date: '28/01', type: 'Venta', account: 'MercadoPago', pen: 266, usd: 0 },
  { date: '28/01', type: 'Venta', account: 'MercadoPago', pen: 176, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -23.55, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -8.50, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -23.55, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -26.40, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -6.00, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -21.30, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -1.00, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -28.35, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -4.50, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -7.00, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -7.00, usd: 0 },
  { date: '29/01', type: 'Gasto', account: 'MercadoPago', pen: -39.90, usd: 0 },
  { date: '29/01', type: 'Venta', account: 'MercadoPago', pen: 142, usd: 0 },
  // Ajuste ANULADO - skip
  { date: '02/02', type: 'Gasto', account: 'MercadoPago', pen: -7.00, usd: 0 },
  { date: '02/02', type: 'Gasto', account: 'MercadoPago', pen: -37.35, usd: 0 },
  { date: '03/02', type: 'Venta', account: 'BCP', pen: 160, usd: 0 },
  { date: '03/02', type: 'Venta', account: 'MercadoPago', pen: 249, usd: 0 },
  { date: '04/02', type: 'Gasto', account: 'MercadoPago', pen: -4.50, usd: 0 },
  { date: '04/02', type: 'Gasto', account: 'MercadoPago', pen: -21.15, usd: 0 },
  { date: '04/02', type: 'Gasto', account: 'MercadoPago', pen: -23.10, usd: 0 },
  { date: '05/02', type: 'Venta', account: 'MercadoPago', pen: 141, usd: 0 },
  { date: '05/02', type: 'Anticipo', account: 'MercadoPago', pen: 154, usd: 0 },
  { date: '07/02', type: 'Gasto', account: 'MercadoPago', pen: -35.55, usd: 0 },
  { date: '08/02', type: 'Anticipo', account: 'MercadoPago', pen: 237, usd: 0 },
  { date: '08/02', type: 'Gasto', account: 'MercadoPago', pen: -18.15, usd: 0 },
  { date: '09/02', type: 'Anticipo', account: 'MercadoPago', pen: 121, usd: 0 },
  { date: '09/02', type: 'Gasto', account: 'MercadoPago', pen: -29.70, usd: 0 },
  { date: '09/02', type: 'Gasto', account: 'MercadoPago', pen: -7.00, usd: 0 },
  { date: '09/02', type: 'Gasto', account: 'MercadoPago', pen: -34.80, usd: 0 },
  { date: '10/02', type: 'Anticipo', account: 'MercadoPago', pen: 232, usd: 0 },
  { date: '10/02', type: 'Venta', account: 'MercadoPago', pen: 198, usd: 0 },
  { date: '10/02', type: 'Gasto', account: 'BCP', pen: -10, usd: 0 },
  { date: '10/02', type: 'Gasto', account: 'MercadoPago', pen: -29.70, usd: 0 },
  { date: '10/02', type: 'Gasto', account: 'MercadoPago', pen: -18.15, usd: 0 },
  { date: '10/02', type: 'Gasto', account: 'MercadoPago', pen: -22.95, usd: 0 },
  { date: '10/02', type: 'Anticipo', account: 'MercadoPago', pen: 121, usd: 0 },
  { date: '11/02', type: 'Venta', account: 'MercadoPago', pen: 198, usd: 0 },
  { date: '11/02', type: 'Anticipo', account: 'MercadoPago', pen: 153, usd: 0 },
  { date: '11/02', type: 'Gasto', account: 'MercadoPago', pen: -23.70, usd: 0 },
  { date: '12/02', type: 'Anticipo', account: 'MercadoPago', pen: 158, usd: 0 },
  { date: '16/02', type: 'Gasto', account: 'MercadoPago', pen: -19.95, usd: 0 },
  { date: '17/02', type: 'Anticipo', account: 'MercadoPago', pen: 133, usd: 0 },
  { date: '17/02', type: 'TransferOUT', account: 'MercadoPago', pen: -2462, usd: 0 },
  { date: '17/02', type: 'TransferIN', account: 'BCP', pen: 2462, usd: 0 },
  { date: '17/02', type: 'Anticipo', account: 'BCP', pen: 10, usd: 0 },
  { date: '17/02', type: 'Gasto', account: 'MercadoPago', pen: -38.55, usd: 0 },
  { date: '17/02', type: 'Gasto', account: 'MercadoPago', pen: -7.00, usd: 0 },
  { date: '18/02', type: 'Venta', account: 'MercadoPago', pen: 257, usd: 0 },
  { date: '18/02', type: 'Gasto', account: 'BCP', pen: -55, usd: 0 },
  { date: '18/02', type: 'Gasto', account: 'MercadoPago', pen: -35.70, usd: 0 },
  { date: '18/02', type: 'Gasto', account: 'MercadoPago', pen: -22.95, usd: 0 },
  { date: '18/02', type: 'Anticipo', account: 'MercadoPago', pen: 238, usd: 0 },
  { date: '19/02', type: 'Anticipo', account: 'MercadoPago', pen: 153, usd: 0 },
  { date: '19/02', type: 'Gasto', account: 'MercadoPago', pen: -21.15, usd: 0 },
  { date: '20/02', type: 'Anticipo', account: 'MercadoPago', pen: 141, usd: 0 },
  { date: '20/02', type: 'ConvOUT', account: 'BCP', pen: -134.40, usd: 0 },
  { date: '20/02', type: 'ConvIN', account: 'BCP', pen: 0, usd: 40 },
];

const saldos = { BCP_PEN: 0, BCP_USD: 0, MP: 0 };
movements.forEach(m => {
  if (m.account === 'BCP') { saldos.BCP_PEN += m.pen; saldos.BCP_USD += m.usd; }
  else if (m.account === 'MercadoPago') { saldos.MP += m.pen; }
});

console.log('=== SALDOS CALCULADOS DESDE MOVIMIENTOS ===');
console.log(`BCP PEN: ${saldos.BCP_PEN.toFixed(2)}`);
console.log(`BCP USD: ${saldos.BCP_USD.toFixed(2)}`);
console.log(`MercadoPago: ${saldos.MP.toFixed(2)}`);
console.log(`Total PEN: ${(saldos.BCP_PEN + saldos.MP).toFixed(2)}`);
console.log('');
console.log('=== SALDOS EN APP ===');
console.log('BCP PEN: 2572.60');
console.log('BCP USD: 40.00');
console.log('MercadoPago: 853.85');
console.log('Total PEN: 3426.45');
console.log('');
console.log('=== DIFERENCIAS ===');
console.log(`BCP PEN: ${(saldos.BCP_PEN - 2572.60).toFixed(2)}`);
console.log(`BCP USD: ${(saldos.BCP_USD - 40).toFixed(2)}`);
console.log(`MP: ${(saldos.MP - 853.85).toFixed(2)}`);

// Feb only
let ingPEN = 0, egPEN = 0;
movements.forEach(m => {
  const parts = m.date.split('/');
  if (parts[1] !== '02') return;
  if (m.type.startsWith('Transfer') || m.type.startsWith('Conv')) return;
  if (m.pen > 0) ingPEN += m.pen;
  else egPEN += Math.abs(m.pen);
});
console.log('');
console.log('=== FEB INGRESOS/EGRESOS PEN ===');
console.log(`Ingresos calc: ${ingPEN.toFixed(2)}`);
console.log(`Egresos calc: ${egPEN.toFixed(2)}`);
console.log(`Balance calc: ${(ingPEN - egPEN).toFixed(2)}`);
console.log('APP: Ing 3048 / Eg 523.10 / Bal 2524.90');
