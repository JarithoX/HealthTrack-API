const { Router } = require('express');
const { validarJWT } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/usuarios.controller');
const router = Router();

router.get('/', ctrl.getUsuarios); 
router.post('/', ctrl.createUsuario); // sin usar
router.delete('/username/:username', validarJWT, ctrl.deleteUsuario);// ♦
// Inicio de sesion por primera vez
router.put('/perfil/:username', ctrl.updatePerfil); // ♦
router.get('/username/:username', ctrl.getUsuarioByUsername);// ♦
router.post('/login', ctrl.loginUsuario);// ♦

module.exports = router;

