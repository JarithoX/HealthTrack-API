const { db } = require('../config/firebase');
// GET: Obtener historial
exports.getMessages = async (req, res) => {
  try {
    const { uid } = req.params; 
    const snapshot = await db.collection('chat').doc(uid).collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp.toDate() // Convertir a fecha legible
      };
    });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// POST: Enviar mensaje (Flexible: Paciente o Profesional)
exports.sendMessage = async (req, res) => {
  try {
    const { uid } = req.params; // ID del paciente (siempre es el ID del chat)
    const { contenido, remitente_tipo, remitente_id } = req.body;
    console.log(req.body);
    
    // Validación básica
    const tipo = remitente_tipo || 'paciente';
    const id = remitente_id || uid;
    const newMessage = {
      contenido,
      remitente_id: id,
      remitente_tipo: tipo,
      leido: false,
      timestamp: new Date()
    };
    // 1. Guardar mensaje
    await db.collection('chat').doc(uid).collection('messages').add(newMessage);
    
    // 2. Actualizar último mensaje
    await db.collection('chat').doc(uid).set({
        ultimo_mensaje: contenido,
        timestamp_ultimo: new Date(),
        participantes: [uid, 'profesional'] 
    }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};