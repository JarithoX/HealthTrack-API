const { Router } = require('express');
const ctrl = require('../controllers/usuarios.controller');
const router = Router();

router.get('/usuarios', ctrl.getUsuarios);
router.post('/usuarios', ctrl.createUsuario);
router.get('/usuarios/:id', ctrl.getUsuarioById);
router.put('/usuarios/:id', ctrl.updateUsuario);
router.patch('/usuarios/:id', ctrl.updateUsuario);
router.delete('/usuarios/:id', ctrl.deleteUsuario);

module.exports = router;

