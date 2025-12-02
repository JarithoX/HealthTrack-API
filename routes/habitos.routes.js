const { Router } = require('express');
const ctrl = require('../controllers/habitos.controller');
const { validarJWT } = require('../middleware/auth.middleware');
const router = Router();

router.post('/habito-definicion', validarJWT, ctrl.crearDefinicion);
router.get('/habito-definicion/:username', validarJWT, ctrl.listarDefiniciones);
router.post('/habito-registro', validarJWT, ctrl.registrarHabito);
router.get('/habito-registro/:username', validarJWT, ctrl.listarRegistrosConDefinicion);
router.delete('/habito-definicion/:id', validarJWT, ctrl.eliminarDefinicion);
module.exports = router;