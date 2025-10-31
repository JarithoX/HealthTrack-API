const { Router } = require('express');
const ctrl = require('../controllers/habitos.controller');
const router = Router();

router.post('/habitos', ctrl.create);
router.get('/habitos/:username', ctrl.listByUsername);


module.exports = router;