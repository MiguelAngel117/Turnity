const express = require('express');
const roleController = require('../../controllers/roleController');
const checkAuth = require('../../middleware/checkAuth');
const checkRoleAuth = require('../../middleware/checkRoleAuth');

const router = express.Router();

// Todas las rutas de roles requieren autenticación y rol de administrador
router.use(checkAuth, checkRoleAuth(['Administrador']));

// Obtener todos los roles
router.get('/', async (req, res) => {
    try {
        const roles = await roleController.getAllRoles();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener rol por nombre
router.get('/:role_name', async (req, res) => {
    try {
        const role = await roleController.getRoleByName(req.params.role_name);
        if (!role) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        res.json(role);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear nuevo rol
router.post('/', async (req, res) => {
    try {
        const newRole = await roleController.createRole(req.body);
        res.status(201).json(newRole);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Actualizar rol
router.put('/:role_name', async (req, res) => {
    try {
        const updatedRole = await roleController.updateRole(req.params.role_name, req.body);
        res.json(updatedRole);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Eliminar rol
router.delete('/:role_name', async (req, res) => {
    try {
        await roleController.deleteRole(req.params.role_name);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener usuarios con un rol específico
router.get('/:role_name/users', async (req, res) => {
    try {
        const users = await roleController.getUsersByRole(req.params.role_name);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;