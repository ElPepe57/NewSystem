import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const now = Timestamp.now();

const users = [
  { uid: 'IJDS5oPdbZTgRPonDNKHZ2tImNm2', email: 'josselyne1220@gmail.com', displayName: 'Jose Luis Pinto Toscano' },
  { uid: 'OCqU58bx9ZMfxToyj3GgOyFslBq2', email: 'usuario2@businessmn.com', displayName: 'Usuario 2' },
  { uid: 'IlFyjjoBAZgLkFt9XSp2uChtBVi2', email: 'usuario3@businessmn.com', displayName: 'Usuario 3' },
  { uid: 'bJkeC3yCUNTXhStsIPy6doEppuG3', email: 'jose.lp9205@gmail.com', displayName: 'Peps Lu' },
];

for (const user of users) {
  const { uid, ...data } = user;
  await db.collection('users').doc(uid).set({
    ...data,
    role: 'admin',
    permisos: [],  // admin doesn't need permisos array, hasPermiso returns true for admin role
    activo: true,
    fechaCreacion: now,
    ultimaConexion: now,
  });
  console.log('Fixed:', uid.slice(0, 12) + '...', '-', data.displayName);
}

console.log('\nDone');
