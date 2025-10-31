const { db, admin } = require('../config/firebase');

const COLL = 'habitos';

// 1. Mapeo y saneamiento de campos
const pickHabitoFields = (body) => ({
    uid: (body.uid || '').trim(),
    tipo: (body.tipo || '').trim().toLowerCase(),
    objetivo: body.objetivo ? parseFloat(body.objetivo) : null,
    unidad: (body.unidad || '').trim(),
    activo: body.activo !== undefined ? body.activo : true,
});

const toPublic = (doc) => {
    const data = doc.data();
    return { id: doc.id, ...data };
};

// POST /api/habitos (Crear)
async function createHabito(req, res) {
    try {
        const base = pickHabitoFields(req.body || {});

        // Validación de campos obligatorios
        if (!base.uid || !base.tipo || base.objetivo === null || !base.unidad) {
            return res.status(400).json({ 
                error: 'Faltan campos obligatorios: uid, tipo, objetivo, unidad.' 
            });
        }

        // Validar tipo de hábito
        const tiposValidos = ['sueno', 'actividad', 'hidratacion', 'alimentacion'];
        if (!tiposValidos.includes(base.tipo)) {
            return res.status(400).json({
                error: `Tipo de hábito inválido. Debe ser uno de: ${tiposValidos.join(', ')}`
            });
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        
        const docRef = await db.collection(COLL).add({
            ...base,
            createdAt: now,
            updatedAt: now,
        });

        const doc = await docRef.get();
        return res.status(201).json({ 
            id: doc.id, 
            ...doc.data(),
            message: 'Hábito creado con éxito.' 
        });
    } catch (err) {
        console.error('createHabito:', err);
        return res.status(err.status || 500).json({ error: err.message || 'Error al crear hábito.' });
    }
}

// GET /api/habitos (Listar)
async function getHabitos(req, res) {
    try {
        console.log('Consultando colección:', COLL);
        let query = db.collection(COLL);
        
        // Aplicar filtros si existen
        const { uid, tipo } = req.query;
        if (uid) {
            console.log('Filtrando por uid:', uid);
            query = query.where('uid', '==', uid);
        }
        if (tipo) {
            console.log('Filtrando por tipo:', tipo);
            query = query.where('tipo', '==', tipo.toLowerCase());
        }

        console.log('Ejecutando consulta...');
        const snap = await query.get();
        console.log(`Encontrados ${snap.docs.length} documentos`);
        
        const items = snap.docs.map(toPublic);
        if (items.length === 0) {
            return res.status(200).json({ 
                message: 'No hay hábitos registrados',
                items: []
            });
        }
        return res.status(200).json(items);
    } catch (err) {
        console.error('Error completo en getHabitos:', err);
        return res.status(500).json({ 
            error: err.message || 'Error al listar hábitos.',
            nota: 'Si usas filtros, puede requerir un índice compuesto en Firestore.' 
        });
    }
}

// GET /api/habitos/:id (Obtener por ID)
async function getHabitoById(req, res) {
    try {
        const { id } = req.params;
        const doc = await db.collection(COLL).doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Hábito no encontrado.' });
        return res.status(200).json(toPublic(doc));
    } catch (err) {
        console.error('getHabitoById:', err);
        return res.status(500).json({ error: 'Error al obtener hábito.' });
    }
}

// PUT /api/habitos/:id (Actualizar)
async function updateHabito(req, res) {
    try {
        const { id } = req.params;
        const ref = db.collection(COLL).doc(id);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Hábito no encontrado.' });

        const incoming = pickHabitoFields(req.body || {});
        const toUpdate = {};
        
        // Solo copiar campos no vacíos o inválidos
        for (const [k, v] of Object.entries(incoming)) {
            if (v !== '' && v !== null && v !== undefined) toUpdate[k] = v;
        }

        // Validar tipo si se está actualizando
        if (toUpdate.tipo) {
            const tiposValidos = ['sueno', 'actividad', 'hidratacion', 'alimentacion'];
            if (!tiposValidos.includes(toUpdate.tipo)) {
                return res.status(400).json({
                    error: `Tipo de hábito inválido. Debe ser uno de: ${tiposValidos.join(', ')}`
                });
            }
        }

        toUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await ref.update(toUpdate);
        const updated = await ref.get();
        return res.status(200).json(toPublic(updated));
    } catch (err) {
        console.error('updateHabito:', err);
        return res.status(err.status || 500).json({ error: err.message || 'Error al actualizar hábito.' });
    }
}

// DELETE /api/habitos/:id (Eliminar)
async function deleteHabito(req, res) {
    try {
        const { id } = req.params;
        const ref = db.collection(COLL).doc(id);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Hábito no encontrado.' });

        await ref.delete();
        return res.status(200).json({ message: 'Hábito eliminado.' });
    } catch (err) {
        console.error('deleteHabito:', err);
        return res.status(500).json({ error: 'Error al eliminar hábito.' });
    }
}

module.exports = {
    create: createHabito,
    list: getHabitos,
    get: getHabitoById,
    update: updateHabito,
    remove: deleteHabito
};
