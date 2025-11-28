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
        // 1. Obtener el username de la URL (req.params)
        const username = req.params.username;
        
        if (!username) {
            return res.status(400).json({ error: 'Falta el username.' });
        }
        
        // 2. Normalizar a minúsculas para la búsqueda en la DB (CORRECCIÓN CLAVE)
        const normalizedUsername = username.toLowerCase(); 

        // Obtener hábitos predefinidos (id_usuario es null)
        const predefinidosSnap = await db.collection(DEF_COLL).where('id_usuario', '==', null).get();
        
        // Obtener hábitos propios del usuario, usando el username normalizado
        const propiosSnap = await db.collection(DEF_COLL).where('id_usuario', '==', normalizedUsername).get(); // <-- USO LA VARIABLE normalizedUsername

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
/**
 * 3. POST /api/habito-registro
 * Registra una entrada diaria de un hábito.
 * Recibe: { id_habito_def, valor_registrado, comentario, fecha, id_usuario (username) }
 */
async function registrarHabito(req, res) {
    const { authData } = req;
    if (!authData || !authData.id_usuario) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    // 1. Obtener datos y validar campos esenciales
    let { 
        id_habito_def, 
        valor_registrado, 
        comentario, 
        fecha, 
        id_usuario 
    } = req.body;

    // LÍNEA DE DEBUG para ver qué ID POSTEÓ EL HTML
    console.log(`DEBUG: ID recibido en el POST desde Django: "${id_habito_def}"`);
    
    // VALIDACIÓN CRÍTICA: Si el ID o la fecha faltan, es un error del frontend (HTML)
    if (!id_habito_def || !fecha || !id_usuario) {
        return res.status(400).json({ error: 'Faltan campos esenciales: id_habito_def, fecha, o id_usuario. (El formulario HTML no envió el ID o la fecha).' });
    }

    let definicion;
    let tipo_medicion;

    // 2. OBTENER Y VERIFICAR DEFINICIÓN en Firestore
    try {
        const defSnapshot = await db.collection(DEF_COLL).doc(id_habito_def).get();

        if (!defSnapshot.exists) { 
            console.error(`ERROR 404: Definición no encontrada para ID: ${id_habito_def}`);
            return res.status(404).json({ error: 'Definición de hábito no encontrada.' });
        }

        // Si el documento existe, extraemos los datos.
        definicion = defSnapshot.data();
        tipo_medicion = definicion.tipo_medicion; 

    } catch (err) {
        console.error('ERROR 500: Fallo en Firestore al buscar definición:', err);
        return res.status(500).json({ error: 'Error interno del servidor al buscar el tipo de hábito.' });
    }

    // 3. Procesamiento del valor
    if (tipo_medicion === 'Binario') {
        // Si el checkbox se marca, Django envía un valor (e.g., '1'). 
        // Si no se marca, no envía el campo. 
        // Por lo tanto, si no es 'undefined' o 'null', lo consideramos 1 (completado).
        valor_registrado = (valor_registrado !== undefined && valor_registrado !== null && valor_registrado !== '0' && valor_registrado !== '') ? 1 : 0;
    } else {
        valor_registrado = Number(valor_registrado);
        if (isNaN(valor_registrado)) {
             return res.status(400).json({ error: 'El valor registrado no es un número válido para este tipo de hábito.' });
        }
    }

    // 4. Crear el objeto de registro y guardar
    const registroData = {
        id_habito_def: id_habito_def,
        id_usuario: id_usuario,
        fecha: fecha,
        valor_registrado: valor_registrado,
        comentario: comentario || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        const docRef = await db.collection(REG_COLL).add(registroData);

        return res.status(201).json({ 
            message: 'Registro guardado con éxito.', 
            id: docRef.id 
        });
    } catch (dbErr) {
        console.error('Error al guardar registro en Firestore:', dbErr);
        return res.status(500).json({ error: 'Error al guardar el registro en la base de datos.' });
    }
}

/**
 * 4. GET /api/habito-registro/:username
 * Obtiene los registros de un usuario para el dashboard (hace el "JOIN").
 */
async function listarRegistrosConDefinicion(req, res) {
    try {
        const username = req.params.username;
        
        if (!username) {
            return res.status(400).json({ error: 'Falta el username en la URL.' });
        }
        
        // 1. Normalizar el username (CORRECCIÓN CLAVE)
        const normalizedUsername = username.toLowerCase(); 

        // 2. Obtener todos los registros del usuario
        const registrosSnap = await db.collection(REG_COLL)
            .where('id_usuario', '==', normalizedUsername) // USAR USERNAME NORMALIZADO
            .get();

        if (registrosSnap.empty) {
            return res.status(200).json([]);
        }

        // 3. Mapear y hacer el "JOIN" con la definición
        const promesas = registrosSnap.docs.map(async (doc) => {
            const registro = doc.data();
            
            // Obtener la definición del hábito
            const defDoc = await db.collection(DEF_COLL).doc(registro.id_habito_def).get();
            if (!defDoc.exists) {
                // Si la definición no existe, ignorar este registro
                return null;
            }

            const definicion = defDoc.data();

            return {
                id_registro: doc.id,
                // Convertir el Timestamp a string ISO (para que Django lo entienda)
                fecha: registro.fecha.toDate ? registro.fecha.toDate().toISOString().split('T')[0] : registro.fecha, 
                valor_registrado: registro.valor_registrado,
                comentario: registro.comentario || '',
                nombre_habito: definicion.nombre,
                meta: definicion.meta,
                tipo_medicion: definicion.tipo_medicion,
            };
        });

        const resultados = await Promise.all(promesas);
        let registrosCompletos = resultados.filter(r => r !== null);

        // 4. Ordenar por fecha en Node (descendente)
        registrosCompletos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return res.status(200).json(registrosCompletos);

    } catch (err) {
        console.error('listarRegistrosConDefinicion:', err);
        return res.status(500).json({ error: 'Error al obtener registros para el dashboard.' });
    }
}
async function eliminarDefinicion(req, res) {
    try {
        const { id } = req.params; // El ID del documento a borrar

        if (!id) {
            return res.status(400).json({ error: 'Falta el ID del hábito.' });
        }

        // Borramos el documento de la colección de definiciones
        await db.collection(DEF_COLL).doc(id).delete();

        return res.status(200).json({ message: 'Hábito eliminado correctamente.' });

    } catch (err) {
        console.error('eliminarDefinicion:', err);
        return res.status(500).json({ error: 'Error al eliminar el hábito.' });
    }
}


module.exports = {
    crearDefinicion,
    listarDefiniciones,
    registrarHabito,
    listarRegistrosConDefinicion,
    eliminarDefinicion
};