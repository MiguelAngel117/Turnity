const express = require('express');
const employeeController = require('../../controllers/employeesController');

const router = express.Router();

// GET: Obtener todos los empleadosuel
router.get('/', async (req, res) => {
    try {
        const employees = await employeeController.getAllEmployees();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener empleado por documento
router.get('/:number_document', async (req, res) => {
    try {
        const employee = await employeeController.getEmployeeByDocument(req.params.number_document);
        if (!employee) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear empleado
router.post('/', async (req, res) => {
    try {
        const newEmployee = await employeeController.createEmployee(req.body);
        res.status(201).json(newEmployee);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar empleado
router.put('/:number_document', async (req, res) => {
    try {
        const updatedEmployee = await employeeController.updateEmployee(req.params.number_document, req.body);
        res.json(updatedEmployee);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar empleado
router.delete('/:number_document', async (req, res) => {
    try {
        await employeeController.deleteEmployee(req.params.number_document);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;