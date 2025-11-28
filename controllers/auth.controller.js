const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const COLL = 'usuario';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET no está definido en las variables de entorno.');
}

// Helpers
const pickUsuarioFields = (body) => {
    const fields = {
        nombre: (body.nombre || '').trim(),
        apellido: (body.apellido || '').trim(),
        email: (body.email || '').trim().toLowerCase(),
        username: (body.username || '').trim(),
        edad: body.edad ? parseInt(body.edad) : null,
        genero: (body.genero || '').trim(),
        altura: body.altura ? parseFloat(body.altura) : null,
        peso: body.peso ? parseFloat(body.peso) : null,
        condiciones_medicas: (body.condiciones_medicas || '').trim(),
    };
    if (body.activo !== undefined) {
        fields.activo = body.activo;
    }
    return fields;
};

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

// POST /api/auth/register
async function createUsuario(req, res) {
    try {
        const { password, ...body } = req.body;

        if (!password || typeof password !== 'string' || password.trim().length < 6) {
            return res.status(400).json({ error: 'La contraseña debe ser un texto de al menos 6 caracteres.' });
        }

        const usuarioData = pickUsuarioFields(body);

        if (!usuarioData.nombre || !usuarioData.apellido || !usuarioData.email || !usuarioData.username) {
            return res.status(400).json({ error: 'Nombre, apellido, email y username son campos requeridos.' });
        }

        await ensureUniqueEmail(usuarioData.email);
        await ensureUniqueUsername(usuarioData.username);

        const userRecord = await admin.auth().createUser({
            email: usuarioData.email,
            password: password,
            displayName: `${usuarioData.nombre} ${usuarioData.apellido}`,
            disabled: false,
        });

        const password_hash = await bcrypt.hash(password, 10);

        const newUsuario = {
            ...usuarioData,
            password_hash: password_hash,
            firebaseUid: userRecord.uid,
            rol: (req.body.rol || 'user').toLowerCase(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await db.collection(COLL).add(newUsuario);
        const doc = await docRef.get();

        return res.status(201).json({
            ...toPublic(doc),
            firebaseUid: userRecord.uid
        });

    } catch (err) {
        console.error('createUsuario:', err);
        if (err.code === 'auth/email-already-exists') {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado en Firebase Auth.' });
        }
        if (err.code === 'auth/invalid-password') {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        }
        if (err.status === 409) {
            return res.status(409).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Error al crear usuario.' });
    }
}

// POST /api/auth/login
async function loginUsuario(req, res) {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identificador (email o username) y contraseña son requeridos.' });
        }

        let email = identifier.includes('@') ? identifier : null;
        if (!email) {
            const snapshot = await db.collection(COLL)
                .where('username', '==', identifier).limit(1).get();

            if (snapshot.empty) {
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }
            const userDoc = snapshot.docs[0];
            const userDataTmp = userDoc.data();
            email = userDataTmp.email;
            if (!email) {
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }
        }

        const apiKey = process.env.FIREBASE_API_KEY;
        if (!apiKey) {
            console.error('FATAL: FIREBASE_API_KEY no está definida en .env');
            return res.status(500).json({ error: 'Error de configuración del servidor.' });
        }

        const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        let firebaseResponse;
        try {
            firebaseResponse = await axios.post(authUrl, {
                email: email,
                password: password,
                returnSecureToken: true
            });
        } catch (error) {
            if (error.response) {
                const errorCode = error.response.data?.error?.message;
                console.error('Firebase Auth Error:', errorCode);
                if (['EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'INVALID_LOGIN_CREDENTIALS'].includes(errorCode)) {
                    return res.status(401).json({ error: 'Credenciales inválidas.' });
                }
                if (errorCode === 'USER_DISABLED') {
                    return res.status(403).json({ error: 'Usuario deshabilitado.' });
                }
                if (errorCode === 'CONFIGURATION_NOT_FOUND') {
                    return res.status(500).json({ error: 'Error de configuración del servidor.' });
                }
                return res.status(401).json({ error: 'Error de autenticación: ' + errorCode });
            }
            throw error;
        }

        const { idToken, localId, email: responseEmail } = firebaseResponse.data;

        let userData = {};
        let docId = localId;
        let rol = 'user';

        const uidSnapshot = await db.collection(COLL).where('firebaseUid', '==', localId).limit(1).get();
        if (!uidSnapshot.empty) {
            const doc = uidSnapshot.docs[0];
            userData = doc.data();
            docId = doc.id;
            rol = userData.rol || 'user';
        } else {
            const emailSnap = await db.collection(COLL).where('email', '==', email).limit(1).get();
            if (!emailSnap.empty) {
                const doc = emailSnap.docs[0];
                userData = doc.data();
                docId = doc.id;
                rol = userData.rol || 'user';
            }
        }

        return res.status(200).json({
            success: true,
            token: idToken,
            user: {
                uid: localId,
                id: docId,
                email: responseEmail,
                rol: rol,
                ...userData
            }
        });

    } catch (err) {
        console.error('Error en loginUsuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

// POST /api/auth/verify-token
async function verificarTokenUsuario(req, res) {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token no proporcionado.' });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        let userData = null;
        let docId = uid;

        const uidSnapshot = await db.collection(COLL).where('firebaseUid', '==', uid).limit(1).get();

        if (!uidSnapshot.empty) {
            const doc = uidSnapshot.docs[0];
            userData = doc.data();
            docId = doc.id;
        } else {
            const userRef = db.collection(COLL).doc(uid);
            const doc = await userRef.get();

            if (doc.exists) {
                userData = doc.data();
            } else {
                if (email) {
                    const snapshot = await db.collection(COLL).where('email', '==', email).limit(1).get();
                    if (!snapshot.empty) {
                        userData = snapshot.docs[0].data();
                        docId = snapshot.docs[0].id;
                    }
                }
            }
        }

        return res.status(200).json({
            valid: true,
            uid: uid,
            email: email,
            rol: userData?.rol || 'user',
            datos: userData || {},
            id: docId
        });

    } catch (error) {
        console.error('Error al verificar token:', error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'El token ha expirado.' });
        }
        return res.status(401).json({ error: 'Token inválido o error de verificación.' });
    }
}

module.exports = {
    createUsuario,
    loginUsuario,
    verificarTokenUsuario,
};
