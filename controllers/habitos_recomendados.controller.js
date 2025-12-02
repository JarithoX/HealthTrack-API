const PlantillaHabitoModel = require('../models/plantilla_habitos.model');

async function getRecomendaciones(req, res) {
    try {
        const { objetivos } = req.body;

        // Validación básica
        if (objetivos && !Array.isArray(objetivos)) {
            return res.status(400).json({ 
                error: 'El campo "objetivos" debe ser un array de textos.' 
            });
        }

        // Llamada al Modelo
        const recomendaciones = await PlantillaHabitoModel.getByObjetivos(objetivos || []);

        return res.status(200).json({
            success: true,
            cantidad: recomendaciones.length,
            data: recomendaciones
        });

    } catch (error) {
        console.error('Error en getRecomendaciones:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor al obtener recomendaciones.' 
        });
    }
}

module.exports = {
    getRecomendaciones
};