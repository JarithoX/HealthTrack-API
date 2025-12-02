const { db } = require('../config/firebase'); 

const COLLECTION_NAME = 'plantillas_habitos';

class PlantillaHabitoModel {
    /**
     * Busca plantillas que coincidan con una lista de objetivos.
     * @param {string[]} objetivos - Array de objetivos del usuario (ej: ['dormir_mejor', 'vivir_sano'])
     * @returns {Promise<Array>} Lista de plantillas encontradas
     */
    static async getByObjetivos(objetivos) {
        try {
            const plantillasRef = db.collection(COLLECTION_NAME);
            let query = plantillasRef;

            // Si hay objetivos, filtramos. Si no, podríamos devolver genéricos o vacío.
            if (objetivos && objetivos.length > 0) {
                // 'categoria_objetivo' es el campo en Firestore (array)
                // 'objetivos' es lo que manda el usuario
                query = query.where('categoria_objetivo', 'array-contains-any', objetivos);
            } else {
                // Si no manda objetivos, limitamos a 10 genéricos para no traer todo
                query = query.limit(10); 
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                return [];
            }

            const plantillas = [];
            snapshot.forEach(doc => {
                plantillas.push({
                    id: doc.id, // Incluimos el ID del documento por si acaso
                    ...doc.data()
                });
            });

            return plantillas;

        } catch (error) {
            console.error('Error en PlantillaHabitoModel.getByObjetivos:', error);
            throw new Error('Error al consultar plantillas de hábitos.');
        }
    }    
}

module.exports = PlantillaHabitoModel;