const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const router = Router();

router.post('/register', ctrl.createUsuario);
router.post('/login', ctrl.loginUsuario);
router.post('/verify-token', ctrl.verificarTokenUsuario);
router.post('/change-password', ctrl.cambiarContrasena);

module.exports = router;
