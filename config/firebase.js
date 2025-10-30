 // Importa el SDK de Firebase Admin
const admin = require('firebase-admin');

function initFirebase() {
  // En producción (Cloud Run) usaremos credenciales por defecto.
  // En local, si existe serviceAccountKey.json, usamos esa.
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('🔥 Firebase Admin inicializado (LOCAL con key JSON)');
  } catch (e) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('🔥 Firebase Admin inicializado (CLOUD con credencial por defecto)');
  }
  return admin.firestore();
}

const db = initFirebase();
module.exports = { db };
