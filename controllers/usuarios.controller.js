const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const UsuarioModel = require('../models/usuario.model');

const COLL = 'usuario';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET no está definido en las variables de entorno.');
}

const toPublic = (doc) => {
    const data = doc.data();
    delete data.password_hash;
    return { id: doc.id, ...data };
};

// GET /api/usuarios (Listar todos)
async function getUsuarios(req, res) {
    try {
        const snap = await db.collection(COLL).get();
        const items = snap.docs.map(toPublic);
        return res.status(200).json(items);
    } catch (err) {
        console.error('getUsuarios:', err);
        return res.status(500).json({ error: 'Error al listar usuarios.' });
    }
}

// DELETE /api/usuarios/username/:username (Eliminar)
async function deleteUsuario(req, res) {
    try {
        const { username } = req.params;
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const docRef = snapshot.docs[0].ref;
        await docRef.delete();

        return res.status(200).json({ message: 'Usuario eliminado.' });

    } catch (err) {
        console.error('deleteUsuario:', err);
        return res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
}

// Función adicional para completar el perfil del usuario
async function updatePerfil(req, res) {
    try {

        const { username: uid } = req.params;

        if (!uid || typeof uid !== 'string' || uid.length < 20) {
            return res.status(400).json({ error: 'Falta un identificador de usuario (UID) válido.' });
        }

        // Validación de datos con el Modelo
        let datosValidos;
        try {
            datosValidos = UsuarioModel.validarPerfilUpdate(req.body);
        } catch (validationError) {
            return res.status(400).json({ error: validationError.message });
        }

        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('firebaseUid', '==', uid).limit(1).get();

        if (snapshot.empty) {
            // Si no encuentra coincidencia por firebaseUid, devuelve 404
            console.log(`Usuario con firebaseUid ${uid} no encontrado en Firestore.`);
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // Obtenemos la referencia al documento real (el que tiene ID aleatorio)
        const docRef = snapshot.docs[0].ref;

        const updatePayload = {
            ...datosValidos,
            updatedAt: new Date().toISOString()
        };

        await docRef.update(updatePayload);

        return res.status(200).json({ message: 'Perfil actualizado con éxito.', updatedFields: Object.keys(updatePayload) });

    } catch (err) {
        console.error('updatePerfil:', err);
        return res.status(500).json({ error: 'Error interno del servidor al actualizar el perfil.' });
    }
}

// Obtener usuario por Username
async function getUsuarioByUsername(req, res) {
    try {
        const username = req.params.username;

        if (!username) {
            return res.status(400).json({ error: 'Se requiere el nombre de usuario.' });
        }

        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        let userData = {};
        let docId = '';

        snapshot.forEach(doc => {
            userData = doc.data();
            docId = doc.id;
        });

        return res.status(200).json({
            id: docId,
            ...userData
        });

    } catch (err) {
        console.error("Error al obtener usuario por username:", err);
        return res.status(500).json({ error: 'Error interno del servidor al buscar usuario.' });
    }
}

// Función para actualización administrativa (permite rol, activo, etc.)
async function updateUsuarioAdmin(req, res) {
    try {
        // Nota: :username aquí se espera que sea el firebaseUid, igual que en updatePerfil
        const { username: uid } = req.params;

        if (!uid || typeof uid !== 'string') {
            return res.status(400).json({ error: 'Identificador de usuario inválido.' });
        }

        // Validación con lógica de Admin
        let datosValidos;
        try {
            datosValidos = UsuarioModel.validarAdminUpdate(req.body);
            console.log('DEBUG: Datos validados:', datosValidos);
        } catch (validationError) {
            console.error('DEBUG: Error de validación:', validationError.message);
            return res.status(400).json({ error: validationError.message });
        }

        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('firebaseUid', '==', uid).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const docRef = snapshot.docs[0].ref;

        const updatePayload = {
            ...datosValidos,
            updatedAt: new Date().toISOString()
        };

        await docRef.update(updatePayload);

        return res.status(200).json({ message: 'Usuario actualizado por Admin.', updatedFields: Object.keys(updatePayload) });

    } catch (err) {
        console.error('updateUsuarioAdmin:', err);
        return res.status(500).json({ error: 'Error interno al actualizar usuario (Admin).' });
    }
}

module.exports = {
    getUsuarios,
    deleteUsuario,
    updatePerfil,
    getUsuarioByUsername,
    updateUsuarioAdmin,
};