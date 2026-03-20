/**
 * Script de seed para Firebase Emulators
 *
 * Uso: npm run emulators:seed
 *
 * Crea datos de prueba para testear el modulo de entregas:
 * - 1 usuario de prueba
 * - 2 clientes
 * - 3 transportistas (2 internos, 1 externo)
 * - 3 productos con unidades en inventario
 * - 2 ventas con diferentes estados de pago
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';

// Config (se conecta al emulador local)
const app = initializeApp({
  apiKey: 'test-api-key',
  authDomain: 'localhost',
  projectId: 'businessmn-269c9',
});

const db = getFirestore(app);
const auth = getAuth(app);

connectFirestoreEmulator(db, 'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

const now = Timestamp.now();

async function seed() {
  console.log('🌱 Sembrando datos de prueba...\n');

  // =============================================
  // 1. USUARIO DE PRUEBA
  // =============================================
  let userId;
  try {
    const userCred = await createUserWithEmailAndPassword(auth, 'test@businessmn.com', 'test1234');
    userId = userCred.user.uid;
    console.log('✅ Usuario creado:', userId);
  } catch (e) {
    // Si ya existe, usar un ID fijo
    userId = 'test-user-001';
    console.log('ℹ️  Usuario ya existe, usando:', userId);
  }

  await setDoc(doc(db, 'usuarios', userId), {
    email: 'test@businessmn.com',
    nombre: 'Tester',
    apellido: 'QA',
    rol: 'admin',
    activo: true,
    fechaCreacion: now,
  });

  // =============================================
  // 2. CLIENTES
  // =============================================
  const clientes = [
    {
      id: 'cli-001',
      nombre: 'Maria Lopez',
      telefono: '999111222',
      email: 'maria@test.com',
      direccion: 'Av. Javier Prado 1234, San Isidro',
      distrito: 'San Isidro',
    },
    {
      id: 'cli-002',
      nombre: 'Carlos Ramirez',
      telefono: '999333444',
      email: 'carlos@test.com',
      direccion: 'Calle Los Olivos 567, Miraflores',
      distrito: 'Miraflores',
    },
  ];

  for (const cli of clientes) {
    await setDoc(doc(db, 'clientes', cli.id), {
      ...cli,
      activo: true,
      fechaCreacion: now,
    });
  }
  console.log(`✅ ${clientes.length} clientes creados`);

  // =============================================
  // 3. TRANSPORTISTAS
  // =============================================
  const transportistas = [
    {
      id: 'trans-001',
      codigo: 'TR-001',
      nombre: 'Juan Motorizado',
      tipo: 'interno',
      telefono: '987654321',
      costoFijo: 15.00,
      tasaExito: 92,
      totalEntregas: 45,
      entregasExitosas: 41,
      entregasFallidas: 4,
      estado: 'activo',
    },
    {
      id: 'trans-002',
      codigo: 'TR-002',
      nombre: 'Pedro Delivery',
      tipo: 'interno',
      telefono: '987654322',
      costoFijo: 12.00,
      tasaExito: 88,
      totalEntregas: 30,
      entregasExitosas: 26,
      entregasFallidas: 4,
      estado: 'activo',
    },
    {
      id: 'trans-003',
      codigo: 'TR-003',
      nombre: 'Olva Express',
      tipo: 'externo',
      courierExterno: 'olva',
      costoFijo: 25.00,
      tasaExito: 95,
      totalEntregas: 120,
      entregasExitosas: 114,
      entregasFallidas: 6,
      estado: 'activo',
    },
  ];

  for (const trans of transportistas) {
    await setDoc(doc(db, 'transportistas', trans.id), {
      ...trans,
      fechaCreacion: now,
    });
  }
  console.log(`✅ ${transportistas.length} transportistas creados`);

  // =============================================
  // 4. PRODUCTOS + UNIDADES
  // =============================================
  const productos = [
    {
      id: 'prod-001',
      sku: 'PROT-WH-001',
      marca: 'ON',
      nombreComercial: 'Gold Standard Whey',
      presentacion: '5 lbs',
      precioVentaPEN: 250.00,
      stock: 10,
    },
    {
      id: 'prod-002',
      sku: 'PROT-ISO-002',
      marca: 'Dymatize',
      nombreComercial: 'ISO 100',
      presentacion: '3 lbs',
      precioVentaPEN: 320.00,
      stock: 8,
    },
    {
      id: 'prod-003',
      sku: 'CREA-MON-003',
      marca: 'MuscleTech',
      nombreComercial: 'Creatina Monohidrato',
      presentacion: '400g',
      precioVentaPEN: 120.00,
      stock: 15,
    },
  ];

  for (const prod of productos) {
    await setDoc(doc(db, 'productos', prod.id), {
      ...prod,
      activo: true,
      fechaCreacion: now,
    });

    // Crear unidades para cada producto
    for (let i = 1; i <= 5; i++) {
      const unidadId = `unit-${prod.id}-${String(i).padStart(3, '0')}`;
      await setDoc(doc(db, 'unidades', unidadId), {
        productoId: prod.id,
        sku: prod.sku,
        marca: prod.marca,
        nombreComercial: prod.nombreComercial,
        presentacion: prod.presentacion,
        estado: 'disponible_peru',
        lote: `LOTE-TEST-001`,
        fechaCreacion: now,
      });
    }
  }
  console.log(`✅ ${productos.length} productos creados (5 unidades c/u)`);

  // =============================================
  // 5. VENTAS
  // =============================================

  // Venta 1: Pago pendiente (para testear cobro en destino)
  await setDoc(doc(db, 'ventas', 'venta-001'), {
    id: 'venta-001',
    numeroVenta: 'VTA-2026-001',
    clienteId: 'cli-001',
    nombreCliente: 'Maria Lopez',
    dniRuc: '45678901',
    telefonoCliente: '999111222',
    emailCliente: 'maria@test.com',
    direccionEntrega: 'Av. Javier Prado 1234, San Isidro',
    estado: 'asignada',
    estadoPago: 'pendiente',
    subtotalPEN: 820.00,
    descuento: 0,
    costoEnvio: 0,
    incluyeEnvio: false,
    totalPEN: 820.00,
    utilidadBrutaPEN: 220.00,
    montoPagado: 0,
    montoPendiente: 820.00,
    pagos: [],
    productos: [
      {
        productoId: 'prod-001',
        sku: 'PROT-WH-001',
        marca: 'ON',
        nombreComercial: 'Gold Standard Whey',
        presentacion: '5 lbs',
        cantidad: 2,
        precioUnitario: 250.00,
        subtotal: 500.00,
        costoTotalUnidades: 380.00,
        unidadesAsignadas: ['unit-prod-001-001', 'unit-prod-001-002'],
      },
      {
        productoId: 'prod-002',
        sku: 'PROT-ISO-002',
        marca: 'Dymatize',
        nombreComercial: 'ISO 100',
        presentacion: '3 lbs',
        cantidad: 1,
        precioUnitario: 320.00,
        subtotal: 320.00,
        costoTotalUnidades: 220.00,
        unidadesAsignadas: ['unit-prod-002-001'],
      },
    ],
    creadoPor: userId,
    fechaCreacion: now,
    fechaConfirmacion: now,
    fechaAsignacion: now,
    observaciones: '',
  });

  // Venta 2: Pago parcial (anticipo de S/ 200)
  await setDoc(doc(db, 'ventas', 'venta-002'), {
    id: 'venta-002',
    numeroVenta: 'VTA-2026-002',
    clienteId: 'cli-002',
    nombreCliente: 'Carlos Ramirez',
    dniRuc: '20567891234',
    telefonoCliente: '999333444',
    emailCliente: 'carlos@test.com',
    direccionEntrega: 'Calle Los Olivos 567, Miraflores',
    estado: 'asignada',
    estadoPago: 'parcial',
    subtotalPEN: 740.00,
    descuento: 0,
    costoEnvio: 0,
    incluyeEnvio: false,
    totalPEN: 740.00,
    utilidadBrutaPEN: 180.00,
    montoPagado: 200.00,
    montoPendiente: 540.00,
    pagos: [
      {
        id: 'PAG-anticipo-001',
        monto: 200.00,
        metodoPago: 'yape',
        tipoPago: 'anticipo',
        fecha: now,
        registradoPor: userId,
        referencia: 'Anticipo por Yape',
      },
    ],
    productos: [
      {
        productoId: 'prod-001',
        sku: 'PROT-WH-001',
        marca: 'ON',
        nombreComercial: 'Gold Standard Whey',
        presentacion: '5 lbs',
        cantidad: 1,
        precioUnitario: 250.00,
        subtotal: 250.00,
        costoTotalUnidades: 190.00,
        unidadesAsignadas: ['unit-prod-001-003'],
      },
      {
        productoId: 'prod-003',
        sku: 'CREA-MON-003',
        marca: 'MuscleTech',
        nombreComercial: 'Creatina Monohidrato',
        presentacion: '400g',
        cantidad: 3,
        precioUnitario: 120.00,
        subtotal: 360.00,
        costoTotalUnidades: 240.00,
        unidadesAsignadas: ['unit-prod-003-001', 'unit-prod-003-002', 'unit-prod-003-003'],
      },
      {
        productoId: 'prod-002',
        sku: 'PROT-ISO-002',
        marca: 'Dymatize',
        nombreComercial: 'ISO 100',
        presentacion: '3 lbs',
        cantidad: 1,
        precioUnitario: 130.00,
        subtotal: 130.00,
        costoTotalUnidades: 130.00,
        unidadesAsignadas: ['unit-prod-002-002'],
      },
    ],
    creadoPor: userId,
    fechaCreacion: now,
    fechaConfirmacion: now,
    fechaAsignacion: now,
    observaciones: '',
  });

  // Venta 3: Pagada completa (para testear que NO pida cobro)
  await setDoc(doc(db, 'ventas', 'venta-003'), {
    id: 'venta-003',
    numeroVenta: 'VTA-2026-003',
    clienteId: 'cli-001',
    nombreCliente: 'Maria Lopez',
    dniRuc: '45678901',
    telefonoCliente: '999111222',
    emailCliente: 'maria@test.com',
    direccionEntrega: 'Av. Javier Prado 1234, San Isidro',
    estado: 'asignada',
    estadoPago: 'pagado',
    subtotalPEN: 250.00,
    descuento: 0,
    costoEnvio: 0,
    incluyeEnvio: false,
    totalPEN: 250.00,
    utilidadBrutaPEN: 60.00,
    montoPagado: 250.00,
    montoPendiente: 0,
    pagos: [
      {
        id: 'PAG-full-001',
        monto: 250.00,
        metodoPago: 'transferencia',
        tipoPago: 'pago',
        fecha: now,
        registradoPor: userId,
        referencia: 'Pago completo por transferencia',
      },
    ],
    productos: [
      {
        productoId: 'prod-001',
        sku: 'PROT-WH-001',
        marca: 'ON',
        nombreComercial: 'Gold Standard Whey',
        presentacion: '5 lbs',
        cantidad: 1,
        precioUnitario: 250.00,
        subtotal: 250.00,
        costoTotalUnidades: 190.00,
        unidadesAsignadas: ['unit-prod-001-004'],
      },
    ],
    creadoPor: userId,
    fechaCreacion: now,
    fechaConfirmacion: now,
    fechaAsignacion: now,
    fechaPagoCompleto: now,
    observaciones: '',
  });

  console.log('✅ 3 ventas creadas:');
  console.log('   VTA-2026-001: Pago pendiente (S/ 820) - para testear cobro en destino');
  console.log('   VTA-2026-002: Pago parcial (S/ 200/740) - para testear cobro inteligente');
  console.log('   VTA-2026-003: Pagada completa (S/ 250) - para verificar que NO pida cobro');

  console.log('\n🎉 Seed completado! Datos listos para testing.\n');
  console.log('Casos de prueba sugeridos:');
  console.log('  1. Programar entrega para VTA-001 → debe pedir cobro S/ 820');
  console.log('  2. Programar entrega para VTA-002 → debe pedir cobro S/ 540 (ya tiene anticipo S/ 200)');
  console.log('  3. Programar entrega para VTA-003 → NO debe pedir cobro (pagada)');
  console.log('  4. Programar entrega parcial VTA-001 (solo 1 producto)');
  console.log('  5. Programar 2da entrega VTA-001 → cantidades restantes');
  console.log('  6. Completar entrega con cobro → verificar pago registrado en venta');
  console.log('  7. Marcar entrega como fallida → verificar modal con 6 motivos');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
