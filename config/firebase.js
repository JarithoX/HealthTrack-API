const admin = require('firebase-admin');

function initFirebase() {
  try {
    // 1. Intento LOCAL: Busca el archivo de credenciales
    // (Este archivo solo existe en tu PC, no se sube a Docker)
    const serviceAccount = require('./serviceAccountKey.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('🔥 Firebase Admin: Inicializado en modo LOCAL (serviceAccountKey)');

  } catch (e) {
    // 2. Fallback CLOUD: Si no encuentra el archivo, asume que estamos en Cloud Run.
    // Inicializamos SIN credenciales explícitas para usar los roles IAM (ADC).
    // Es vital que FIREBASE_PROJECT_ID esté en las variables de entorno.
    
    if (!admin.apps.length) { // Evita reinicializar si ya existe
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID, 
        });
    }
    
    console.log('☁️ Firebase Admin: Inicializado en modo CLOUD (IAM / ADC)');
  }

  return admin.firestore();
}

const db = initFirebase();

// Exportamos tanto la instancia de DB como el objeto admin completo
module.exports = { db, admin };