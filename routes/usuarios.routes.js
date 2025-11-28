const { Router } = require('express');
const { validarJWT } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/usuarios.controller');
const router = Router();

router.get('/', ctrl.getUsuarios);
router.delete('/username/:username', validarJWT, ctrl.deleteUsuario);
router.put('/perfil/:username', ctrl.updatePerfil);
router.get('/username/:username', ctrl.getUsuarioByUsername);

module.exports = router;

