/**
 * Diccionario Maestro de Hábitos
 * Asocia cada "objetivo" (key) con una lista de hábitos sugeridos (values).
 */
const HABITOS_DB = {
    'dormir_mejor': [
        {
            titulo: 'A la cama temprano',
            descripcion: 'Intenta estar en la cama a tu hora objetivo. La consistencia es clave.',
            icon: 'bi-moon-stars',
            color: 'text-primary'
        },
        {
            titulo: 'Desconexión Digital',
            descripcion: 'Deja las pantallas 1 hora antes de dormir para mejorar la melatonina.',
            icon: 'bi-phone-vibrate',
            color: 'text-dark'
        }
    ],
    'vivir_saludable': [
        {
            titulo: 'Caminata Diaria',
            descripcion: 'Camina al menos 30 minutos al día para activar tu sistema cardiovascular.',
            icon: 'bi-person-walking',
            color: 'text-success'
        },
        {
            titulo: 'Hidratación',
            descripcion: 'Bebe un vaso de agua antes de cada comida.',
            icon: 'bi-droplet',
            color: 'text-info'
        }
    ],
    'aliviar_presion': [
        {
            titulo: 'Respiración Profunda',
            descripcion: 'Tómate 5 minutos para respirar profundamente cuando sientas tensión.',
            icon: 'bi-wind',
            color: 'text-info'
        },
        {
            titulo: 'Pausa Activa',
            descripcion: 'Levántate y estírate cada 2 horas de trabajo.',
            icon: 'bi-alarm',
            color: 'text-danger'
        }
    ],
    'mejor_relacion': [
        {
            titulo: 'Tiempo de Calidad',
            descripcion: 'Dedica 30 minutos sin distracciones a hablar con un ser querido.',
            icon: 'bi-heart',
            color: 'text-danger'
        }
    ],
    'centrarme': [
        {
            titulo: 'Modo Enfoque',
            descripcion: 'Usa la técnica Pomodoro: 25 min de trabajo, 5 de descanso.',
            icon: 'bi-bullseye',
            color: 'text-primary'
        }
    ],
    'probar_cosas': [
        {
            titulo: 'Aprende algo nuevo',
            descripcion: 'Lee 10 páginas de un libro sobre un tema desconocido para ti.',
            icon: 'bi-book',
            color: 'text-warning'
        }
    ]
};

/**
 * Endpoint: /api/habitos-recomendados
 * Method: POST
 * Body: { objetivos: ["obj1", "obj2"] }
 */
const getHabitosRecomendados = async (req, res) => {
    try {
        const { objetivos } = req.body;
        if (!objetivos || !Array.isArray(objetivos)) {
            // Si no envían objetivos, devolvemos una lista vacía o genérica
            return res.status(200).json({ data: [] });
        }
        let recomendaciones = [];
        let procesados = new Set(); // Para evitar duplicados si un hábito se repite
        // Recorremos los objetivos del usuario y buscamos sus hábitos
        objetivos.forEach(obj => {
            const habitosDelObjetivo = HABITOS_DB[obj];
            if (habitosDelObjetivo) {
                habitosDelObjetivo.forEach(habito => {
                    // Usamos el título como clave única para no repetir
                    if (!procesados.has(habito.titulo)) {
                        recomendaciones.push(habito);
                        procesados.add(habito.titulo);
                    }
                });
            }
        });
        return res.status(200).json({
            message: 'Recomendaciones generadas',
            data: recomendaciones
        });
    } catch (error) {
        console.error("Error getHabitosRecomendados:", error);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = {
    getHabitosRecomendados
};