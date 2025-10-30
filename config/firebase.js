// Importa el SDK de Firebase Admin
const admin = require('firebase-admin');

// Importa tus credenciales (asegúrate de que esta ruta sea correcta)
const serviceAccount = require('../serviceAccountKey.json'); 

// Inicializa la aplicación de Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Exporta la instancia de Firestore para usarla en los controladores
const db = admin.firestore();

console.log('🔥 Conexión a Firestore inicializada.');

module.exports = { db };