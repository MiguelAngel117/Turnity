const express = require('express');
const departmentStoreController = require('../../controllers/departmentStoreController');

const router = express.Router();

// GET: Obtener todos los departamentos de tiendas
router.get('/', checkAuth, async (req, res) => {
    try {
        const departmentStores = await departmentStoreController.getAllDepartmentStores();
        res.json(departmentStores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener departamentos por tienda
router.get('/store/:id_store', checkAuth, async (req, res) => {
    try {
        const departmentStores = await departmentStoreController.getDepartmentsByStore(req.params.id_store);
        res.json(departmentStores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener departamento de tienda por ID
router.get('/:id_store_dep', checkAuth, async (req, res) => {
    try {
        const departmentStore = await departmentStoreController.getDepartmentStoreById(req.params.id_store_dep);
        if (!departmentStore) {
            return res.status(404).json({ message: 'Departamento de tienda no encontrado' });
        }
        res.json(departmentStore);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// POST: Crear departamento de tienda
router.post('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const newDepartmentStore = await departmentStoreController.createDepartmentStore(req.body);
        res.status(201).json(newDepartmentStore);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar departamento de tienda
router.put('/:id_store_dep', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const updatedDepartmentStore = await departmentStoreController.updateDepartmentStore(req.params.id_store_dep, req.body);
        res.json(updatedDepartmentStore);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar departamento de tienda
router.delete('/:id_store_dep', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        await departmentStoreController.deleteDepartmentStore(req.params.id_store_dep);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;