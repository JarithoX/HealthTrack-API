// healthtrack-api/controllers/usuarios.controller.js (ACTUALIZADO)

const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');

const COLL = 'usuario';

// 1. Mapeo y saneamiento de campos (debe coincidir con Firestore)
const pickUsuarioFields = (body) => ({
    // Campos requeridos en Firestore:
    nombre: (body.nombre || '').trim(),
    apellido: (body.apellido || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    username: (body.username || '').trim(),
    
    // Campos opcionales/numéricos/de formato específico:
    edad: body.edad ? parseInt(body.edad) : null, // Convertir a número entero
    genero: (body.genero || '').trim(), // Usa 'genero' en lugar de 'sexo'
    altura: body.altura ? parseFloat(body.altura) : null,
    peso: body.peso ? parseFloat(body.peso) : null,
    
    // Campos que puedes eliminar si no son necesarios en el POST inicial:
    // condiciones_medicas: (body.condiciones_medicas || '').trim(), 
});

const toPublic = (doc) => {
    const data = doc.data();
    // No exponer el hash de la contraseña en las respuestas GET/PUT
    delete data.password_hash;
    return { id: doc.id, ...data };
};

// Funciones de validación de unicidad (sin cambios)
async function ensureUniqueEmail(email, ignoreId = null) {
    if (!email) return;
    const snap = await db.collection(COLL).where('email', '==', email).limit(1).get();
    if (!snap.empty && snap.docs[0].id !== ignoreId) {
        const e = new Error('El correo ya está registrado.');
        e.status = 409;
        throw e;
    }
}

async function ensureUniqueUsername(username, ignoreId = null) {
    if (!username) return;
    const snap = await db.collection(COLL).where('username', '==', username).limit(1).get();
    if (!snap.empty && snap.docs[0].id !== ignoreId) {
        const e = new Error('El nombre de usuario ya está en uso.');
        e.status = 409;
        throw e;
    }
}

// POST /api/usuarios (Crear)
async function createUsuario(req, res) {
    try {
        const base = pickUsuarioFields(req.body || {});
        const password = req.body?.password || '';

        // Validación de campos obligatorios
        if (!base.email || !base.username || !password || !base.nombre || !base.apellido) {
            return res.status(400).json({ 
                error: 'Faltan campos obligatorios: nombre, apellido, email, username, password.' 
            });
        }
        
        await ensureUniqueEmail(base.email);
        await ensureUniqueUsername(base.username);

        const password_hash = await bcrypt.hash(password, 10);
        const now = admin.firestore.FieldValue.serverTimestamp();
        
        // El rol por defecto es 'user', pero si el body lo trae, lo usa (ej. para 'profesional')
        const role = (req.body?.rol || 'user').toLowerCase(); 

        const docRef = await db.collection(COLL).add({
            ...base,
            password_hash,
            rol: role, // Guarda el campo 'rol' (tal como está en Firestore)
            activo: true,
            fecha_registro: now, // Usando el nombre del campo de Firestore
            updatedAt: now,
        });

        return res.status(201).json({ id: docRef.id, message: 'Usuario creado con éxito.' });
    } catch (err) {
        console.error('createUsuario:', err);
        return res.status(err.status || 500).json({ error: err.message || 'Error al crear usuario.' });
    }
}

// GET /api/usuarios (Listar)
async function getUsuarios(_req, res) {
    try {
        const snap = await db.collection(COLL).get();
        const items = snap.docs.map(toPublic);
        return res.status(200).json(items);
    } catch (err) {
        console.error('getUsuarios:', err);
        return res.status(500).json({ error: 'Error al listar usuarios.' });
    }
}

// GET /api/usuarios/:id (Obtener por ID)
async function getUsuarioById(req, res) {
    try {
        const { id } = req.params;
        const doc = await db.collection(COLL).doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.status(200).json(toPublic(doc));
    } catch (err) {
        console.error('getUsuarioById:', err);
        return res.status(500).json({ error: 'Error al obtener usuario.' });
    }
}

// PUT/PATCH /api/usuarios/:id (Actualizar)
async function updateUsuario(req, res) {
    try {
        const { id } = req.params;
        const ref = db.collection(COLL).doc(id);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

        const incoming = pickUsuarioFields(req.body || {});
        const toUpdate = {};
        // Solo copiar campos no vacíos, nulos o inválidos
        for (const [k, v] of Object.entries(incoming)) {
            // Aseguramos que los valores como 0 o null (si vienen de parseInt/parseFloat) sean válidos para actualizar
            if (v !== '' && v !== null && v !== undefined) toUpdate[k] = v;
        }

        // Unicidad si cambian email/username
        if (toUpdate.email) await ensureUniqueEmail(toUpdate.email, id);
        if (toUpdate.username) await ensureUniqueUsername(toUpdate.username, id);

        // Si viene password, re-hash
        if (req.body?.password) {
            toUpdate.password_hash = await bcrypt.hash(req.body.password, 10);
        }

        toUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await ref.update(toUpdate);
        const updated = await ref.get();
        return res.status(200).json(toPublic(updated));
    } catch (err) {
        console.error('updateUsuario:', err);
        return res.status(err.status || 500).json({ error: err.message || 'Error al actualizar usuario.' });
    }
}

// DELETE /api/usuarios/:id (Eliminar)
async function deleteUsuario(req, res) {
    try {
        const { id } = req.params;
        const ref = db.collection(COLL).doc(id);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

        await ref.delete();
        return res.status(200).json({ message: 'Usuario eliminado.' });
    } catch (err) {
        console.error('deleteUsuario:', err);
        return res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
}

module.exports = {
    createUsuario,
    getUsuarios,
    getUsuarioById,
    updateUsuario,
    deleteUsuario,
};