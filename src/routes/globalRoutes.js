const express = require('express');
const router = express.Router();

const api = '/turnity'; 

router.use(`${api}/employees`, require('./api/employees'));
router.use(`${api}/stores`, require('./api/stores'));
router.use(`${api}/departments`, require('./api/departments'));
router.use(`${api}/departmentStore`, require('./api/departmentStore'));
router.use(`${api}/employeeDep`, require('./api/employeeDepartment'));
router.use(`${api}/position`, require('./api/positions'));
router.use(`${api}/employeeShift`, require('./api/employeeShift'));
router.use(`${api}/shifts`, require('./api/shifts'));
router.use(`${api}/users`, require('./api/users'));

module.exports = router;