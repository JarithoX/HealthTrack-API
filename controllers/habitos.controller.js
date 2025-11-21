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

        // 1. Obtener todos los registros del usuario (SIN orderBy en Firestore)
        const registrosSnap = await db.collection(REG_COLL)
            .where('id_usuario', '==', username)
            .get();

        // 2. Mapear y "unir" (join) con la definición
        const promesas = registrosSnap.docs.map(async (doc) => {
            const registro = doc.data();

            const defDoc = await db.collection(DEF_COLL).doc(registro.id_habito_def).get();
            if (!defDoc.exists) {
                return null;
            }

            const definicion = defDoc.data();

            return {
                id_registro: doc.id,
                fecha: registro.fecha.toDate ? registro.fecha.toDate().toISOString() : registro.fecha,
                valor_registrado: registro.valor_registrado,
                comentario: registro.comentario,
                nombre_habito: definicion.nombre,
                meta: definicion.meta,
                tipo_medicion: definicion.tipo_medicion,
            };
        });

        const resultados = await Promise.all(promesas);
        let registrosCompletos = resultados.filter(r => r !== null);

        // 3. Ordenar por fecha en Node (descendente)
        registrosCompletos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return res.status(200).json(registrosCompletos);

    } catch (err) {
        console.error('listarRegistrosConDefinicion:', err);
        return res.status(500).json({ error: 'Error al obtener registros para el dashboard.' });
    }
}


module.exports = {
    crearDefinicion,
    listarDefiniciones,
    registrarHabito,
    listarRegistrosConDefinicion, 
};