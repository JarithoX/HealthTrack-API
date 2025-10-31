// Tu archivo firebase.js (CORREGIDO)

// Importa el SDK de Firebase Admin
const admin = require('firebase-admin');

function initFirebase() {
  // En producción (Cloud Run) usaremos credenciales por defecto.
  // En local, si existe serviceAccountKey.json, usamos esa.
  try {
      // ⚠️ VERIFICA LA RUTA: Si este archivo está en /config, debe ser '../serviceAccountKey.json'
      const serviceAccount = require('./serviceAccountKey.json'); 
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('🔥 Firebase Admin inicializado (LOCAL con key JSON)');
  } catch (e) {
      console.error("Error al cargar serviceAccountKey.json. Usando credenciales por defecto:", e.message);
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('🔥 Firebase Admin inicializado (CLOUD/DESARROLLO con credencial por defecto)');
  }
  return admin.firestore();
}

const db = initFirebase();

// 🚀 LA CORRECCIÓN CLAVE: Exportar ambos 'db' y 'admin'
module.exports = { db, admin };