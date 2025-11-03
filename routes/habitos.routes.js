const { Router } = require('express');
const ctrl = require('../controllers/habitos.controller');
const router = Router();

// Nueva logica (considerando 2 entidades de firebase)
router.post('/habito-definicion', ctrl.crearDefinicion);
router.get('/habito-definicion/:username', ctrl.listarDefiniciones);
router.post('/habito-registro', ctrl.registrarHabito);
router.get('/habito-registro/:username', ctrl.listarRegistrosConDefinicion);

module.exports = router;