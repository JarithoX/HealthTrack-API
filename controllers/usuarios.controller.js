// controllers/usuarios.controller.js
const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');

const COLL = 'users';

const pickUsuarioFields = (body) => ({
  nombres: (body.nombres || '').trim(),
  apellidos: (body.apellidos || '').trim(),
  email: (body.email || '').trim().toLowerCase(),
  edad: (body.edad || '').trim(),
  sexo: (body.sexo || '').trim(),
  condiciones_medicas: (body.condiciones_medicas || '').trim(),
  username: (body.username || '').trim(),
});

const toPublic = (doc) => {
  const data = doc.data();
  delete data.password_hash;
  return { id: doc.id, ...data };
};

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

// POST /api/usuarios  (Crear)
async function createUsuario(req, res) {
  try {
    const base = pickUsuarioFields(req.body || {});
    const password = req.body?.password || '';

    if (!base.email || !base.username || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: email, username, password.' });
    }

    await ensureUniqueEmail(base.email);
    await ensureUniqueUsername(base.username);

    const password_hash = await bcrypt.hash(password, 10);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const docRef = await db.collection(COLL).add({
      ...base,
      password_hash,
      role: 'user',
      activo: true,
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({ id: docRef.id, message: 'Usuario creado con éxito.' });
  } catch (err) {
    console.error('createUsuario:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Error al crear usuario.' });
  }
}

// GET /api/usuarios  (Listar)
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

// GET /api/usuarios/:id  (Obtener por ID)
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

// PUT/PATCH /api/usuarios/:id  (Actualizar)
async function updateUsuario(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection(COLL).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const incoming = pickUsuarioFields(req.body || {});
    const toUpdate = {};
    // Solo copiar campos no vacíos
    for (const [k, v] of Object.entries(incoming)) {
      if (v !== '') toUpdate[k] = v;
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

// DELETE /api/usuarios/:id  (Eliminar)
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
