const { Router } = require('express');
const ctrl = require('../controllers/habitos_recomendados.controller');

const router = Router();

// Endpoint: POST /api/habitos-recomendados
// Body esperado: { "objetivos": ["dormir_mejor", ...] }
router.post('/', ctrl.getHabitosRecomendados);


module.exports = router;