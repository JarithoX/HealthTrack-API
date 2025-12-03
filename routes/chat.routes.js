const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
router.get('/:uid', chatController.getMessages);
router.post('/:uid', chatController.sendMessage);
module.exports = router;