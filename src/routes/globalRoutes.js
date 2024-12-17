const express = require('express');
const router = express.Router();

const api = '/turnity'; 

router.use(`${api}/employees`, require('./api/employees'));
router.use(`${api}/stores`, require('./api/stores'));
router.use(`${api}/departments`, require('./api/departments'));
router.use(`${api}/departmentStore`, require('./api/departmentStore'));
router.use(`${api}/position`, require('./api/positions'));
router.use(`${api}/shifts`, require('./api/shifts'));

module.exports = router;