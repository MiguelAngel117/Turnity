const express = require('express');
const router = express.Router();

const api = '/turnity'; 

router.use(`${api}/shifts`, require('./api/shifts'));
router.use(`${api}/employees`, require('./api/employees'));

module.exports = router;