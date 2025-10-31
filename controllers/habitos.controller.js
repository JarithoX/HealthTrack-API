const { db, admin } = require('../config/firebase');

const COLL = 'habitos';
const USUARIO_COLL = 'usuario';

// Helper para convertir datos de Firestore
const toHabitoPublic = (data) => {
    // Si la fecha es un Timestamp de Firestore, convertirla a string ISO para Django
    const fecha = data.fecha && data.fecha.toDate ? data.fecha.toDate().toISOString() : data.fecha;

    return {
        fecha: fecha,
        calorias: data.calorias,
        pasos: data.pasos,
        horas_sueno: data.horas_sueno,
        litros_agua: data.litros_agua,
        comentario: data.comentario || 'Sin comentario',
    };
};

// ----------------------------------------------------------------------
// 1. POST /api/habitos (Registro de Métrica Diaria desde Django)
// ----------------------------------------------------------------------
async function registrarMétricas(req, res) {
    try {
        // Campos que envía Django desde forms.py
        const { username, calorias, pasos, horas_sueno, litros_agua, comentario, fecha } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Falta el username de usuario.' });
        }
        
        // --- Paso A: Buscar el ID del Documento de Usuario ---
        const usuarioSnapshot = await db.collection(USUARIO_COLL)
            .where('username', '==', username)
            .limit(1)
            .get();

        if (usuarioSnapshot.empty) {
            // Este error puede ocurrir si el usuario existe en Django Auth, pero no en tu colección 'usuario' de Firestore.
            return res.status(404).json({ error: 'Usuario no encontrado en la colección de Firestore.' });
        }
        
        const usuarioDocId = usuarioSnapshot.docs[0].id;
        // Creamos la Referencia que necesita el campo 'id_usuario' de Firestore (ej. /usuario/ID_DEL_DOC)
        const id_usuario_ref = db.doc(`${USUARIO_COLL}/${usuarioDocId}`);
        
        // --- Paso B: Crear el Nuevo Registro Diario ---
        const nuevoRegistro = {
            calorias: parseFloat(calorias) || 0,
            pasos: parseInt(pasos) || 0,
            horas_sueno: parseFloat(horas_sueno) || 0,
            litros_agua: parseFloat(litros_agua) || 0,
            comentario: comentario || '',
            
            // Campo de referencia: esencial para vincular el hábito al usuario
            id_usuario: id_usuario_ref, 
            
            // Convertir la fecha ISO de Django a Timestamp
            fecha: new Date(fecha), 
            
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        await db.collection(COLL).add(nuevoRegistro);

        // Respuesta 201 (Creado) para Django
        return res.status(201).json({ message: 'Registro de métricas guardado con éxito.' });

    } catch (err) {
        console.error('registrarMétricas:', err);
        return res.status(500).json({ error: 'Error al registrar métricas diarias.' });
    }
}

// ----------------------------------------------------------------------
// 2. GET /api/habitos/:username (Listado para Django)
// ----------------------------------------------------------------------
async function listarPorUsuario(req, res) {
    try {
        const username = req.params.username;
        if (!username) {
            return res.status(400).json({ error: 'Falta el username en la URL.' });
        }
        
        // --- Paso A: Buscar el ID del Documento de Usuario ---
        const usuarioSnapshot = await db.collection(USUARIO_COLL)
            .where('username', '==', username)
            .limit(1)
            .get();

        if (usuarioSnapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        
        const usuarioDocId = usuarioSnapshot.docs[0].id;
        const id_usuario_ref = db.doc(`${USUARIO_COLL}/${usuarioDocId}`);

        // --- Paso B: Obtener los hábitos asociados a esa referencia ---
        const snap = await db.collection(COLL)
            .where('id_usuario', '==', id_usuario_ref)
            .orderBy('fecha', 'desc') 
            .get();

        // Mapear y devolver
        const habitos = snap.docs.map(doc => toHabitoPublic(doc.data()));
        
        // Devolvemos el array dentro de la clave 'habitos' que espera Django
        return res.status(200).json({ habitos: habitos }); 

    } catch (err) {
        console.error('listarPorUsuario:', err);
        return res.status(500).json({ error: 'Error al listar métricas.' });
    }
}


// --- EXPORTACIÓN DEL MÓDULO ---
module.exports = {
    
    create: registrarMétricas, 
    listByUsername: listarPorUsuario, 
    
    
};