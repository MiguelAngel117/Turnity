const express = require('express');
const departmentController = require('../../controllers/departmentController');

const router = express.Router();
const checkAuth = require('../../middleware/checkAuth');
const checkRoleAuth = require('../../middleware/checkRoleAuth');

// GET: Obtener todos los departamentos
router.get('/', checkAuth, async (req, res) => {
    try {
        const departments = await departmentController.getAllDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener departamento por ID
router.get('/:id_department', checkAuth, async (req, res) => {
    try {
        const department = await departmentController.getDepartmentById(req.params.id_department);
        if (!department) {
            return res.status(404).json({ message: 'Departamento no encontrado' });
        }
        res.json(department);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear departamento
router.post('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const newDepartment = await departmentController.createDepartment(req.body);
        res.status(201).json(newDepartment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar departamento
router.put('/:id_department', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const updatedDepartment = await departmentController.updateDepartment(req.params.id_department, req.body);
        res.json(updatedDepartment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar departamento
router.delete('/:id_department', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        await departmentController.deleteDepartment(req.params.id_department);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;