const { Router } = require('express');
const ctrl = require('../controllers/habitos.controller');
const router = Router();

router.get('/habitos', ctrl.list);         // GET /api/habitos
router.post('/habitos', ctrl.create);      // POST /api/habitos
router.get('/habitos/:id', ctrl.get);       // GET /api/habitos/:id
router.put('/habitos/:id', ctrl.update);    // PUT /api/habitos/:id
router.delete('/habitos/:id', ctrl.remove); // DELETE /api/habitos/:id

module.exports = router;
