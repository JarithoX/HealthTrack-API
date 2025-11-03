const { Router } = require('express');
const ctrl = require('../controllers/usuarios.controller');
const router = Router();

router.get('/', ctrl.getUsuarios);
router.post('/', ctrl.createUsuario);
router.delete('/:id', ctrl.deleteUsuario);

//Nueva ruta para completar el perfil
router.put('/perfil/:username', ctrl.updatePerfil); 
//🚨 NUEVA RUTA: Buscar por username (la que usará Django)
router.get('/username/:username', ctrl.getUsuarioByUsername);
router.post('/login', ctrl.loginUsuario);

module.exports = router;

