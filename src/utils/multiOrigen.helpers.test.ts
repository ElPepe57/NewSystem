import { describe, it, expect } from 'vitest';
import {
  normalizarEstadoUnidad,
  esEstadoEnOrigen,
  esEstadoEnTransitoOrigen,
  esEstadoFueraDePerú,
  esEstadoActivo,
  normalizarTipoTransferencia,
  esTipoTransferenciaInterna,
  esTipoTransferenciaInternacional,
  normalizarTipoGasto,
  esFleteInternacional,
  normalizarEstadoAsignacion,
  esEstadoEnAlmacenOrigen,
  getCostoFleteInternacional,
  getPaisEmoji,
  getPaisNombre,
  esPaisOrigen,
  getLabelEstadoUnidad,
  getLabelTipoTransferencia,
} from './multiOrigen.helpers';

// ---------------------------------------------------------------------------
// normalizarEstadoUnidad
// ---------------------------------------------------------------------------
describe('normalizarEstadoUnidad', () => {
  it('convierte recibida_usa → recibida_origen', () => {
    expect(normalizarEstadoUnidad('recibida_usa')).toBe('recibida_origen');
  });

  it('convierte en_transito_usa → en_transito_origen', () => {
    expect(normalizarEstadoUnidad('en_transito_usa')).toBe('en_transito_origen');
  });

  it('deja pasar estados genéricos sin cambio', () => {
    const estadosGenéricos = [
      'recibida_origen', 'en_transito_origen', 'en_transito_peru',
      'disponible_peru', 'reservada', 'asignada_pedido', 'vendida',
      'vencida', 'danada',
    ] as const;
    for (const estado of estadosGenéricos) {
      expect(normalizarEstadoUnidad(estado)).toBe(estado);
    }
  });
});

// ---------------------------------------------------------------------------
// esEstadoEnOrigen
// ---------------------------------------------------------------------------
describe('esEstadoEnOrigen', () => {
  it('reconoce recibida_origen como estado en origen', () => {
    expect(esEstadoEnOrigen('recibida_origen')).toBe(true);
  });

  it('reconoce recibida_usa (legacy) como estado en origen', () => {
    expect(esEstadoEnOrigen('recibida_usa')).toBe(true);
  });

  it('rechaza estados que no son origen', () => {
    expect(esEstadoEnOrigen('disponible_peru')).toBe(false);
    expect(esEstadoEnOrigen('vendida')).toBe(false);
    expect(esEstadoEnOrigen('reservada')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// esEstadoEnTransitoOrigen
// ---------------------------------------------------------------------------
describe('esEstadoEnTransitoOrigen', () => {
  it('reconoce en_transito_origen', () => {
    expect(esEstadoEnTransitoOrigen('en_transito_origen')).toBe(true);
  });

  it('reconoce en_transito_usa (legacy)', () => {
    expect(esEstadoEnTransitoOrigen('en_transito_usa')).toBe(true);
  });

  it('rechaza en_transito_peru', () => {
    expect(esEstadoEnTransitoOrigen('en_transito_peru')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// esEstadoFueraDePerú
// ---------------------------------------------------------------------------
describe('esEstadoFueraDePerú', () => {
  it('true para recibida_origen', () => {
    expect(esEstadoFueraDePerú('recibida_origen')).toBe(true);
  });

  it('true para recibida_usa (legacy)', () => {
    expect(esEstadoFueraDePerú('recibida_usa')).toBe(true);
  });

  it('true para en_transito_origen', () => {
    expect(esEstadoFueraDePerú('en_transito_origen')).toBe(true);
  });

  it('true para en_transito_peru', () => {
    expect(esEstadoFueraDePerú('en_transito_peru')).toBe(true);
  });

  it('false para disponible_peru', () => {
    expect(esEstadoFueraDePerú('disponible_peru')).toBe(false);
  });

  it('false para vendida', () => {
    expect(esEstadoFueraDePerú('vendida')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// esEstadoActivo
// ---------------------------------------------------------------------------
describe('esEstadoActivo', () => {
  const estadosActivos = [
    'recibida_origen', 'recibida_usa',
    'en_transito_origen', 'en_transito_usa',
    'en_transito_peru', 'disponible_peru', 'reservada', 'asignada_pedido',
  ] as const;

  const estadosNoActivos = ['vendida', 'vencida', 'danada'] as const;

  for (const estado of estadosActivos) {
    it(`true para ${estado}`, () => {
      expect(esEstadoActivo(estado)).toBe(true);
    });
  }

  for (const estado of estadosNoActivos) {
    it(`false para ${estado}`, () => {
      expect(esEstadoActivo(estado)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// normalizarTipoTransferencia
// ---------------------------------------------------------------------------
describe('normalizarTipoTransferencia', () => {
  it('convierte interna_usa → interna_origen', () => {
    expect(normalizarTipoTransferencia('interna_usa')).toBe('interna_origen');
  });

  it('convierte usa_peru → internacional_peru', () => {
    expect(normalizarTipoTransferencia('usa_peru')).toBe('internacional_peru');
  });

  it('deja pasar tipos genéricos sin cambio', () => {
    expect(normalizarTipoTransferencia('interna_origen')).toBe('interna_origen');
    expect(normalizarTipoTransferencia('internacional_peru')).toBe('internacional_peru');
  });
});

// ---------------------------------------------------------------------------
// esTipoTransferenciaInterna / esTipoTransferenciaInternacional
// ---------------------------------------------------------------------------
describe('esTipoTransferenciaInterna', () => {
  it('true para interna_origen e interna_usa', () => {
    expect(esTipoTransferenciaInterna('interna_origen')).toBe(true);
    expect(esTipoTransferenciaInterna('interna_usa')).toBe(true);
  });

  it('false para tipos internacionales', () => {
    expect(esTipoTransferenciaInterna('internacional_peru')).toBe(false);
    expect(esTipoTransferenciaInterna('usa_peru')).toBe(false);
  });
});

describe('esTipoTransferenciaInternacional', () => {
  it('true para internacional_peru y usa_peru', () => {
    expect(esTipoTransferenciaInternacional('internacional_peru')).toBe(true);
    expect(esTipoTransferenciaInternacional('usa_peru')).toBe(true);
  });

  it('false para tipos internos', () => {
    expect(esTipoTransferenciaInternacional('interna_origen')).toBe(false);
    expect(esTipoTransferenciaInternacional('interna_usa')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizarTipoGasto / esFleteInternacional
// ---------------------------------------------------------------------------
describe('normalizarTipoGasto', () => {
  it('convierte flete_usa_peru → flete_internacional', () => {
    expect(normalizarTipoGasto('flete_usa_peru')).toBe('flete_internacional');
  });

  it('deja pasar otros tipos sin cambio', () => {
    expect(normalizarTipoGasto('flete_internacional')).toBe('flete_internacional');
    expect(normalizarTipoGasto('almacenaje')).toBe('almacenaje');
    expect(normalizarTipoGasto('delivery')).toBe('delivery');
  });
});

describe('esFleteInternacional', () => {
  it('true para flete_internacional y flete_usa_peru', () => {
    expect(esFleteInternacional('flete_internacional')).toBe(true);
    expect(esFleteInternacional('flete_usa_peru')).toBe(true);
  });

  it('false para otros tipos de gasto', () => {
    expect(esFleteInternacional('almacenaje')).toBe(false);
    expect(esFleteInternacional('delivery')).toBe(false);
    expect(esFleteInternacional('comision_ml')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizarEstadoAsignacion / esEstadoEnAlmacenOrigen
// ---------------------------------------------------------------------------
describe('normalizarEstadoAsignacion', () => {
  it('convierte en_almacen_usa → en_almacen_origen', () => {
    expect(normalizarEstadoAsignacion('en_almacen_usa')).toBe('en_almacen_origen');
  });

  it('deja pasar otros estados sin cambio', () => {
    expect(normalizarEstadoAsignacion('pendiente')).toBe('pendiente');
    expect(normalizarEstadoAsignacion('en_almacen_origen')).toBe('en_almacen_origen');
    expect(normalizarEstadoAsignacion('recibido')).toBe('recibido');
  });
});

describe('esEstadoEnAlmacenOrigen', () => {
  it('true para en_almacen_origen y en_almacen_usa', () => {
    expect(esEstadoEnAlmacenOrigen('en_almacen_origen')).toBe(true);
    expect(esEstadoEnAlmacenOrigen('en_almacen_usa')).toBe(true);
  });

  it('false para otros estados', () => {
    expect(esEstadoEnAlmacenOrigen('pendiente')).toBe(false);
    expect(esEstadoEnAlmacenOrigen('recibido')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCostoFleteInternacional
// ---------------------------------------------------------------------------
describe('getCostoFleteInternacional', () => {
  it('retorna costoFleteInternacional si existe', () => {
    expect(getCostoFleteInternacional({ costoFleteInternacional: 25 })).toBe(25);
  });

  it('retorna 0 si costoFleteInternacional es undefined', () => {
    expect(getCostoFleteInternacional({})).toBe(0);
  });

  it('retorna 0 si costoFleteInternacional es 0', () => {
    expect(getCostoFleteInternacional({ costoFleteInternacional: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PAISES_CONFIG helpers: getPaisEmoji, getPaisNombre, esPaisOrigen
// ---------------------------------------------------------------------------
describe('getPaisEmoji', () => {
  it('retorna emoji correcto para países conocidos', () => {
    expect(getPaisEmoji('USA')).toBe('🇺🇸');
    expect(getPaisEmoji('China')).toBe('🇨🇳');
    expect(getPaisEmoji('Corea')).toBe('🇰🇷');
    expect(getPaisEmoji('Peru')).toBe('🇵🇪');
  });

  it('retorna emoji genérico para países desconocidos', () => {
    expect(getPaisEmoji('Atlantida')).toBe('🌍');
  });
});

describe('getPaisNombre', () => {
  it('retorna el nombre correcto para países conocidos', () => {
    expect(getPaisNombre('USA')).toBe('Estados Unidos');
    expect(getPaisNombre('China')).toBe('China');
    expect(getPaisNombre('Peru')).toBe('Perú');
  });

  it('retorna el código original para países desconocidos', () => {
    expect(getPaisNombre('XYZ')).toBe('XYZ');
  });
});

describe('esPaisOrigen', () => {
  it('true para países de origen (USA, China, Corea)', () => {
    expect(esPaisOrigen('USA')).toBe(true);
    expect(esPaisOrigen('China')).toBe(true);
    expect(esPaisOrigen('Corea')).toBe(true);
  });

  it('false para Perú (destino)', () => {
    expect(esPaisOrigen('Peru')).toBe(false);
    expect(esPaisOrigen('Peru_local')).toBe(false);
  });

  it('true por defecto para países desconocidos', () => {
    // PAISES_CONFIG[pais]?.esOrigen ?? true
    expect(esPaisOrigen('Atlantida')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLabelEstadoUnidad
// ---------------------------------------------------------------------------
describe('getLabelEstadoUnidad', () => {
  it('normaliza estados legacy antes de mostrar label', () => {
    // recibida_usa debe mapearse a recibida_origen
    const label = getLabelEstadoUnidad('recibida_usa', 'USA');
    expect(label).toContain('Recibida');
  });

  it('retorna label con país cuando se proporciona', () => {
    const label = getLabelEstadoUnidad('recibida_origen', 'USA');
    expect(label).toContain('USA');
  });

  it('retorna label genérico cuando no se proporciona país', () => {
    const label = getLabelEstadoUnidad('recibida_origen');
    expect(label).toContain('Origen');
  });

  it('retorna label correcto para disponible_peru', () => {
    expect(getLabelEstadoUnidad('disponible_peru')).toContain('Disponible');
  });

  it('retorna label correcto para vendida', () => {
    expect(getLabelEstadoUnidad('vendida')).toContain('Vendida');
  });
});

// ---------------------------------------------------------------------------
// getLabelTipoTransferencia
// ---------------------------------------------------------------------------
describe('getLabelTipoTransferencia', () => {
  it('normaliza interna_usa antes de generar label', () => {
    const label = getLabelTipoTransferencia('interna_usa', 'USA');
    expect(label).toContain('USA');
  });

  it('usa label genérico interna_origen sin país', () => {
    const label = getLabelTipoTransferencia('interna_origen');
    expect(label).toContain('Interna Origen');
  });

  it('genera label con ruta para tipo internacional', () => {
    const label = getLabelTipoTransferencia('internacional_peru', 'USA');
    expect(label).toBe('USA → Perú');
  });

  it('usa label genérico internacional sin país', () => {
    const label = getLabelTipoTransferencia('internacional_peru');
    expect(label).toContain('Internacional');
  });
});
