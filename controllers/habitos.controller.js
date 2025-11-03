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
            // createdAt: Para registrar cuándo se creó el registro
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // YO LO BORRARIA, YA QUE TENEMOS 'FECHA'
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

// ==================================================================
// NUEVA LÓGICA (Flexible, 2 Colecciones)
// Colección 1: 'habito_definicion' (La meta, el nombre)
// Colección 2: 'habito_registro' (La entrada diaria)
// ==================================================================

const DEF_COLL = 'habito_definicion';
const REG_COLL = 'habito_registro';


/**
 * 1. POST /api/habito-definicion
 * Crea una nueva definición de hábito (un hábito personalizado).
 * Recibe: { nombre, tipo_medicion, meta, frecuencia, id_usuario (username) }
 */
async function crearDefinicion(req, res){
    try {
        const { nombre, tipo_medicion, meta, frecuencia, id_usuario } = req.body;

        if (!nombre || !tipo_medicion || !meta || !id_usuario) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, tipo_medicion, meta, id_usuario.' });
        }

        const nuevaDefinicion = {
            nombre,
            tipo_medicion,
            meta,
            frecuencia: frecuencia || 'Diaria',
            id_usuario, // Este es el username
        };

        const docRef = await db.collection(DEF_COLL).add(nuevaDefinicion);
        return res.status(201).json({ id: docRef.id, message: 'Definición de hábito creada con éxito.' });

    } catch (err) {
        console.error('crearDefinicion:', err);
        return res.status(500).json({ error: 'Error al crear la definición del hábito.' });
    }
}

/**
 * 2. GET /api/habito-definicion/:username
 * Obtiene la lista de hábitos que un usuario puede registrar (Predefinidos + Propios).
 * Usado para llenar el formulario de registro en Django.
 */
async function listarDefiniciones(req, res) {
    try {
        const username = req.params.username;
        if (!username) {
            return res.status(400).json({ error: 'Falta el username.' });
        }

        // Obtener hábitos predefinidos (id_usuario es null)
        const predefinidosSnap = await db.collection(DEF_COLL).where('id_usuario', '==', null).get();
        
        // Obtener hábitos propios del usuario
        const propiosSnap = await db.collection(DEF_COLL).where('id_usuario', '==', username).get();

        const predefinidos = predefinidosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const propios = propiosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const definiciones = [...predefinidos, ...propios];
        
        return res.status(200).json(definiciones);

    } catch (err) {
        console.error('listarDefiniciones:', err);
        return res.status(500).json({ error: 'Error al listar definiciones.' });
    }
}


/**
 * 3. POST /api/habito-registro
 * Registra una entrada diaria de un hábito.
 * Recibe: { id_habito_def, valor_registrado, comentario, fecha, id_usuario (username) }
 */
async function registrarHabito(req, res) {
    try {
        const { id_habito_def, valor_registrado, comentario, fecha, id_usuario } = req.body;

        if (!id_habito_def || !valor_registrado || !fecha || !id_usuario) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: id_habito_def, valor_registrado, fecha, id_usuario.' });
        }
            
        const nuevoRegistro = {
            id_habito_def,   // ID del documento de 'habito_definicion'
            valor_registrado, // El valor numérico o "completado"
            comentario: comentario || '',
            fecha: new Date(fecha), // Convertir la fecha ISO de Django a Timestamp
            id_usuario,     // Username
        };
            
        await db.collection(REG_COLL).add(nuevoRegistro);

        return res.status(201).json({ message: 'Registro de hábito guardado con éxito.' });

    } catch (err) {
        console.error('registrarHabito:', err);
        return res.status(500).json({ error: 'Error al guardar el registro del hábito.' });
    }
}

/**
 * 4. GET /api/habito-registro/:username
 * Obtiene los registros de un usuario para el dashboard (hace el "JOIN").
 */
async function listarRegistrosConDefinicion(req, res) {
    try {
        const username = req.params.username;
        
        // 1. Obtener todos los registros del usuario
        const registrosSnap = await db.collection(REG_COLL)
            .where('id_usuario', '==', username)
            .orderBy('fecha', 'desc')
            .get();

        // 2. Mapear y "unir" (join) con la definición
        // (Usamos Promise.all para manejar las consultas asíncronas de forma eficiente)
        const promesas = registrosSnap.docs.map(async (doc) => {
            const registro = doc.data();
            
            // 3. Obtener el documento de definición correspondiente
            const defDoc = await db.collection(DEF_COLL).doc(registro.id_habito_def).get();
            
            if (!defDoc.exists) {
                return null; // El hábito (ej. "Pasos") fue borrado pero el registro quedó
            }
            
            const definicion = defDoc.data();
            
            // 4. Combinar los datos para Django
            return {
                id_registro: doc.id,
                fecha: registro.fecha.toDate ? registro.fecha.toDate().toISOString() : registro.fecha,
                valor_registrado: registro.valor_registrado,
                comentario: registro.comentario,
                // Datos de la definición (para el gráfico)
                nombre_habito: definicion.nombre,
                meta: definicion.meta,
                tipo_medicion: definicion.tipo_medicion,
            };
        });

        const resultados = await Promise.all(promesas);
        const registrosCompletos = resultados.filter(r => r !== null); // Limpiar nulos

        return res.status(200).json(registrosCompletos);

    } catch (err) {
        console.error('listarRegistrosConDefinicion:', err);
        return res.status(500).json({ error: 'Error al obtener registros para el dashboard.' });
    }
}





// --- EXPORTACIÓN DEL MÓDULO ---
module.exports = {
    
    create: registrarMétricas, 
    listByUsername: listarPorUsuario, 
    //nueva logica
    crearDefinicion,
    listarDefiniciones,
    registrarHabito,
    listarRegistrosConDefinicion,
    
};