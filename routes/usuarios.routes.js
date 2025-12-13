const { Router } = require('express');
const { validarJWT } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/usuarios.controller');
const router = Router();

router.get('/', ctrl.getUsuarios);
router.delete('/username/:username', validarJWT, ctrl.deleteUsuario);
router.put('/perfil/:username', ctrl.updatePerfil); // validarJWT eliminado
router.put('/admin/update/:username', validarJWT, ctrl.updateUsuarioAdmin); // Nueva ruta admin
router.put('/:uid', ctrl.actualizarIdentidad); // Actualizar identidad (nombre, apellido, email, username)
router.put('/assign/:uid', ctrl.asignarPaciente); // Asignar paciente a profesional
router.get('/username/:username', ctrl.getUsuarioByUsername);

module.exports = router;

