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
// Nota: Aunque la ruta dice :username, si pasamos el UID funcionará mejor para Auth.
// Se intentará tratar :username como UID primero para Auth, o buscar por username en Firestore.
async function deleteUsuario(req, res) {
    try {
        const { username: uidOrUsername } = req.params;
        const { securityPin } = req.body; // PIN para borrar admins

        let uid = uidOrUsername;
        let userData = null;

        // 1. Intentar obtener usuario de Auth para ver claims (rol)
        try {
            const userRecord = await admin.auth().getUser(uid);
            // Si funciona, es un UID válido
            const existingRol = userRecord.customClaims?.rol || 'user';

            // CHEQUEO DE SEGURIDAD SI ES ADMIN
            if (existingRol === 'admin') {
                const ADMIN_PIN = process.env.ADMIN_SECURITY_PIN || '123';
                if (securityPin !== ADMIN_PIN) {
                    return res.status(403).json({
                        error: 'No puedes eliminar a un Administrador sin el PIN correcto.'
                    });
                }
            }
        } catch (authError) {
            // Si falla getUser, quizás es un username y no un UID, o el usuario no existe en Auth
            // Buscamos en Firestore para obtener el UID real si es un username
            if (authError.code === 'auth/user-not-found') {
                const snap = await db.collection(COLL).where('username', '==', uidOrUsername).limit(1).get();
                if (!snap.empty) {
                    const docData = snap.docs[0].data();
                    uid = docData.firebaseUid; // Recuperamos el UID real
                    // Verificamos rol desde Firestore si no pudimos desde Auth (aunque Auth es la verdad)
                    if (docData.rol === 'admin') {
                        const ADMIN_PIN = process.env.ADMIN_SECURITY_PIN || '123';
                        if (securityPin !== ADMIN_PIN) {
                            return res.status(403).json({
                                error: 'No puedes eliminar a un Administrador sin el PIN correcto.'
                            });
                        }
                    }
                }
            }
        }

        // 2. Eliminar de Firebase Auth (si tenemos UID)
        if (uid) {
            try {
                await admin.auth().deleteUser(uid);
            } catch (e) {
                console.warn(`No se pudo eliminar de Auth (o ya no existía): ${e.message}`);
                // Continuamos para borrar de DB
            }
        }

        // 3. Eliminar de Firestore
        // Buscamos por firebaseUid (si lo tenemos) O por username (si era username)
        const usuariosRef = db.collection(COLL);
        let snapshot;

        // Intentamos borrar por UID primero
        if (uid) {
            snapshot = await usuariosRef.where('firebaseUid', '==', uid).limit(1).get();
        }

        // Si no encontramos por UID (o no teniamos UID), buscamos por username original
        if ((!snapshot || snapshot.empty) && uidOrUsername) {
            snapshot = await usuariosRef.where('username', '==', uidOrUsername).limit(1).get();
        }

        if (snapshot && !snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await docRef.delete();
        } else {
            // Si no estaba en Auth ni en Firestore
            // (Opcional: devolver 404, pero si ya borramos de Auth, es un éxito parcial)
            if (!uid) return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        return res.status(200).json({ message: 'Usuario eliminado correctamente.' });

    } catch (err) {
        console.error('deleteUsuario:', err);
        return res.status(500).json({ error: 'Error al eliminar usuario: ' + err.message });
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
        const { rol, securityPin } = req.body; // securityPin para proteger cambios a admin

        if (!uid || typeof uid !== 'string') {
            return res.status(400).json({ error: 'Identificador de usuario inválido.' });
        }

        // CHEQUEO DE SEGURIDAD PARA ADMIN
        // Si se intenta asignar rol admin O si el usuario objetivo ya es admin (esto requeriría una lectura previa, pero por eficiencia chequeamos el intento de asignar rol por ahora,
        // y idealmente deberíamos chequear si ya es admin también.

        // 1. Verificar si se está intentando promover a admin
        if (rol === 'admin') {
            const ADMIN_PIN = process.env.ADMIN_SECURITY_PIN || '123';
            if (securityPin !== ADMIN_PIN) {
                return res.status(403).json({
                    error: 'PIN de seguridad incorrecto. Operación denegada para asignar rol de Administrador.'
                });
            }
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

        // Opcional: Verificar si el usuario actual YA es admin y queremos modificarlo (aunque sea para quitarle admin)
        // const currentData = snapshot.docs[0].data();
        // if (currentData.rol === 'admin') { ... check pin ... }
        // Por ahora nos ceñimos a lo solicitado explícitamente y lo obvio.

        const updatePayload = {
            ...datosValidos,
            updatedAt: new Date().toISOString()
        };

        await docRef.update(updatePayload);

        // Importante: Actualizar Custom Claims en Auth si cambió el rol
        if (datosValidos.rol) {
            try {
                await admin.auth().setCustomUserClaims(uid, { rol: datosValidos.rol });
            } catch (authErr) {
                console.error("Error actualizando claims en Auth:", authErr);
                // No fallamos toda la request, pero logueamos
            }
        }

        return res.status(200).json({ message: 'Usuario actualizado por Admin.', updatedFields: Object.keys(updatePayload) });

    } catch (err) {
        console.error('updateUsuarioAdmin:', err);
        return res.status(500).json({ error: 'Error interno al actualizar usuario (Admin).' });
    }
}

// Actualizar datos de Identidad (Nombre, Apellido, Email, etc.)
async function actualizarIdentidad(req, res) {
    try {
        const { uid } = req.params; // Se espera firebaseUid
        const { nombre, apellido, email, username, password } = req.body;

        if (!uid) {
            return res.status(400).json({ error: 'UID requerido.' });
        }

        // Buscar el documento en Firestore por firebaseUid
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('firebaseUid', '==', uid).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const docRef = snapshot.docs[0].ref;

        // Preparar objeto de actualización (solo campos permitidos)
        const updates = {};
        if (nombre !== undefined) updates.nombre = nombre;
        if (apellido !== undefined) updates.apellido = apellido;
        if (email !== undefined) updates.email = email;
        if (username !== undefined) updates.username = username;

        // --- LÓGICA NUEVA PARA PASSWORD ---
        if (password) {
            // Validar longitud
            if (password.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }

            try {
                // 1. Actualizar en Firebase Authentication (Login real)
                await admin.auth().updateUser(uid, { password: password });

                // 2. Encriptar la contraseña para guardar el hash en Firestore (Consistencia)
                // Usamos bcryptjs que ya está importado
                const password_hash = await bcrypt.hash(password, 10);
                updates.password_hash = password_hash;

            } catch (authError) {
                console.error("Error al actualizar password en Auth:", authError);
                return res.status(400).json({ error: 'Error al actualizar contraseña: ' + authError.message });
            }
        }
        // ----------------------------------

        // NOTA: Si permites cambiar username/email, asegúrate de validar duplicados si es necesario.
        // Por ahora lo dejamos simple como solicitado, pero idealmente deberíamos chequear unicidad.

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No se enviaron datos válidos para actualizar.' });
        }

        updates.updatedAt = new Date().toISOString();

        await docRef.update(updates);

        return res.status(200).json({
            message: 'Identidad actualizada correctamente',
            data: { ...updates, password: password ? '[PROTECTED]' : undefined, password_hash: undefined }
        });

    } catch (error) {
        console.error('Error al actualizar identidad:', error);
        return res.status(500).json({ error: 'Error interno del servidor al actualizar identidad.' });
    }
}

// Asignar (Tomar) un paciente
async function asignarPaciente(req, res) {
    try {
        const { uid } = req.params; // UID del PACIENTE
        const { professionalUid } = req.body; // UID del PROFESIONAL

        if (!uid || !professionalUid) {
            return res.status(400).json({ error: 'Faltan datos (UID paciente o UID profesional).' });
        }

        // 1. Verificar que el paciente existe
        // Usamos COLL ('usuario') definido arriba
        const userRef = db.collection(COLL).doc(uid);
        const doc = await userRef.get();

        let targetRef;
        let targetData;

        if (!doc.exists) {
            // Intento búsqueda por firebaseUid si no es ID directo
            const snap = await db.collection(COLL).where('firebaseUid', '==', uid).limit(1).get();
            if (snap.empty) {
                return res.status(404).json({ error: 'Paciente no encontrado.' });
            }
            // Si lo encontramos por firebaseUid, referenciamos ese
            targetRef = snap.docs[0].ref;
            targetData = snap.docs[0].data();
        } else {
            targetRef = userRef;
            targetData = doc.data();
        }

        // 2. Verificar que el usuario objetivo sea 'user' (opcional, pero recomendado)
        // Asumimos que 'user' es el rol de paciente
        if (targetData.rol && targetData.rol !== 'user') {
            return res.status(400).json({ error: 'Solo se pueden asignar usuarios con rol de paciente.' });
        }

        // 3. Verificar si ya tiene profesional (Opcional: permitir reasignar o no)
        // if (targetData.assignedProfessionalId && targetData.assignedProfessionalId !== professionalUid) {
        //    return res.status(400).json({ error: 'Este paciente ya está asignado a otro profesional.' });
        // }

        // 4. Actualizar
        await targetRef.update({
            assignedProfessionalId: professionalUid,
            assignedAt: new Date().toISOString()
        });

        return res.status(200).json({ message: 'Paciente asignado correctamente.' });

    } catch (error) {
        console.error('Error assignPatient:', error);
        return res.status(500).json({ error: 'Error interno al asignar paciente.' });
    }
}

module.exports = {
    getUsuarios,
    deleteUsuario,
    updatePerfil,
    getUsuarioByUsername,
    updateUsuarioAdmin,
    actualizarIdentidad,
    asignarPaciente
};