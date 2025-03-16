const express = require('express');
const positionController = require('../../controllers/positionsController');
const checkAuth = require('../../middleware/checkAuth');
const checkRoleAuth = require('../../middleware/checkRoleAuth');

const router = express.Router();

// GET: Obtener todas las posiciones
router.get('/', checkAuth, async (req, res) => {
    try {
        const positions = await positionController.getAllPositions();
        res.json(positions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener posición por ID
router.get('/:id_position', checkAuth, async (req, res) => {
    try {
        const position = await positionController.getPositionById(req.params.id_position);
        if (!position) {
            return res.status(404).json({ message: 'Posición no encontrada' });
        }
        res.json(position);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear posición
router.post('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const newPosition = await positionController.createPosition(req.body);
        res.status(201).json(newPosition);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar posición
router.put('/:id_position', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const updatedPosition = await positionController.updatePosition(req.params.id_position, req.body);
        res.json(updatedPosition);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar posición
router.delete('/:id_position', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        await positionController.deletePosition(req.params.id_position);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;