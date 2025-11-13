const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COLL = 'usuario';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    // Si la aplicación se inicia sin el .env o sin la variable.
    throw new Error('FATAL: JWT_SECRET no está definido en las variables de entorno. Por favor, configúralo en el archivo .env.');
}

// 1. Mapeo y saneamiento de campos (debe coincidir con Firestore)
const pickUsuarioFields = (body) => ({
    // Campos requeridos en Firestore:

    nombre: (body.nombre || '').trim(),
    apellido: (body.apellido || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    username: (body.username || '').trim(),
    activo: (body.activo !== undefined ? body.activo : undefined),
    
    // Campos opcionales/numéricos/de formato específico:
    edad: body.edad ? parseInt(body.edad) : null, // Convertir a número entero
    genero: (body.genero || '').trim(), // Usa 'genero' en lugar de 'sexo'
    altura: body.altura ? parseFloat(body.altura) : null,
    peso: body.peso ? parseFloat(body.peso) : null,
    
    // Campos que puedes eliminar si no son necesarios en el POST inicial:
    condiciones_medicas: (body.condiciones_medicas || '').trim(), 
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

        const usuarioCompleto = {
            ...base,
            peso: null, 
            altura: null,
            genero: null,
            edad: null,
            condiciones_medicas: '',
            activo: false, // false para el post-login inicial
        };
        
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
            activo: false,
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

// DELETE /api/usuarios/username/:username (Eliminar)
async function deleteUsuario(req, res) {
    try {
        const { username } = req.params;
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        // 3. Obtener la referencia del documento para eliminar
        // Un snapshot de límite 1 siempre tiene solo un documento (o ninguno)
        const docRef = snapshot.docs[0].ref;

        // 4. Eliminar el documento encontrado
        await docRef.delete();

        // 5. Éxito (se recomienda 204 No Content para operaciones DELETE exitosas sin retorno)
        //return res.status(204).send(); 
        // Alternativamente, puedes devolver 200 con un mensaje JSON si lo prefieres:
        return res.status(200).json({ message: 'Usuario eliminado.' });

    } catch (err) {
        console.error('deleteUsuario:', err);
        return res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
}

// Función adicional para completar el perfil del usuario
async function updatePerfil(req, res) {
try {
        const { username } = req.params;
        // El body puede contener: { rol, activo, nombre, peso, altura, email, etc. }
        const dataToUpdate = req.body; 

        // 1. Buscar el usuario por username
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // 2. Obtener la referencia del documento
        const docRef = snapshot.docs[0].ref;

        // 3. Agregar el timestamp de actualización
        // (Asegúrate de que 'admin1' no edite el password_hash sin querer)
        const updatePayload = {
            ...dataToUpdate,
            updatedAt: new Date().toISOString()
        };

        // ⚠️ Prevenir la actualización de campos sensibles si no son manejados explícitamente ⚠️
        // Por ejemplo, no permitir que se cambie el password_hash ni el username
        if (updatePayload.password_hash) {
            delete updatePayload.password_hash;
        }
        if (updatePayload.username) {
            delete updatePayload.username;
        }


        // 4. Actualizar el documento en Firestore
        // La función .update() fusiona los datos, manteniendo los campos no mencionados.
        await docRef.update(updatePayload);

        return res.status(200).json({ message: 'Perfil actualizado con éxito.', updatedFields: Object.keys(updatePayload) });

    } catch (err) {
        console.error('updatePerfil:', err);
        return res.status(500).json({ error: 'Error interno del servidor al actualizar el perfil.' });
    }
}
// 🚨 NUEVA FUNCIÓN: Obtener usuario por Username
async function getUsuarioByUsername(req, res) {
    try {
        const username = req.params.username; // El nombre de usuario viene de la URL
        
        if (!username) {
            return res.status(400).json({ error: 'Se requiere el nombre de usuario.' });
        }
        
        // 1. Crear una consulta para buscar el documento que coincida con el campo 'username'
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        let userData = {};
        let docId = '';

        // 2. Extraer el documento encontrado (solo hay uno por la unicidad del username)
        snapshot.forEach(doc => {
            userData = doc.data();
            docId = doc.id; 
        });
        
        // 3. Devolver los datos del usuario para que Django pueda verificar el perfil
        return res.status(200).json({ 
            id: docId, 
            ...userData 
        });

    } catch (err) {
        console.error("Error al obtener usuario por username:", err);
        return res.status(500).json({ error: 'Error interno del servidor al buscar usuario.' });
    }
}

async function loginUsuario(req, res) {
    try {
        const { username, password } = req.body;

        // 1. Busca el usuario por username
        const usuariosRef = db.collection(COLL);
        const snapshot = await usuariosRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            // Evita revelar si el usuario existe o no por seguridad
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const userData = snapshot.docs[0].data();
        const passwordHash = userData.password_hash;
        // Asignamos el ID del documento para el token
        const userId = snapshot.docs[0].id; 

        // 2. Compara la contraseña (la magia ocurre aquí)
        const isMatch = await bcrypt.compare(password, passwordHash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // 🚨GENERACIÓN DEL TOKEN JWT 
        const payload = {
            uid: userId,               // ID de Firestore (para consultas futuras)
            username: userData.username, // Username
            rol: userData.rol || 'user', // Rol (para la autorización del middleware)
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: '24h', // Token válido por 24 horas
        });        

        // Creamos un objeto limpio para la respuesta (opcional, pero buena práctica)
        const responseData = {
            username: userData.username,
            rol: userData.rol || 'user',      
            activo: userData.activo || false,
            email: userData.email,
            token: token,
            id: userId,
        };

        // 3. Éxito
        return res.status(200).json(responseData);

    } catch (err) {
        console.error('Error en loginUsuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}



module.exports = {
    createUsuario,
    getUsuarios,
    deleteUsuario,
    updatePerfil,
    getUsuarioByUsername,
    loginUsuario,
};