const express = require('express');
const storeController = require('../../controllers/storeController');

const router = express.Router();
const checkAuth = require('../../middleware/checkAuth');
const checkRoleAuth = require('../../middleware/checkRoleAuth');

// GET: Obtener todas las tiendas
router.get('/', checkAuth, async (req, res) => {
    try {
        const stores = await storeController.getAllStores();
        res.json(stores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener tienda por ID
router.get('/:id_store', checkAuth, async (req, res) => {
    try {
        const store = await storeController.getStoreById(req.params.id_store);
        if (!store) {
            return res.status(404).json({ message: 'Tienda no encontrada' });
        }
        res.json(store);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear tienda
router.post('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const newStore = await storeController.createStore(req.body);
        res.status(201).json(newStore);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar tienda
router.put('/:id_store', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const updatedStore = await storeController.updateStore(req.params.id_store, req.body);
        res.json(updatedStore);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar tienda
router.delete('/:id_store', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        await storeController.deleteStore(req.params.id_store);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;