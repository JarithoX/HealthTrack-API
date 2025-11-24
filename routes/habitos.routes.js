const { Router } = require('express');
const ctrl = require('../controllers/habitos.controller');
const router = Router();

router.post('/habito-definicion', ctrl.crearDefinicion);
router.get('/habito-definicion/:username', ctrl.listarDefiniciones);
router.post('/habito-registro', ctrl.registrarHabito);
router.get('/habito-registro/:username', ctrl.listarRegistrosConDefinicion);
router.delete('/habito-definicion/:id', ctrl.eliminarDefinicion);
module.exports = router;