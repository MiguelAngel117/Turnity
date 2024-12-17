const express = require('express');
const shiftController = require('../../controllers/shiftsController');

const router = express.Router();

// GET: Obtener todos los turnos
router.get('/', async (req, res) => {
    try {
        const shifts = await shiftController.getAllShifts();
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener turno por ID
router.get('/:id_shift', async (req, res) => {
    try {
        const shift = await shiftController.getShiftById(req.params.id_shift);
        if (!shift) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        res.json(shift);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener turnos por empleado
router.get('/employee/:number_document', async (req, res) => {
    try {
        const shifts = await shiftController.getShiftsByEmployee(req.params.number_document);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Obtener turnos por rango de fechas
router.get('/date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const shifts = await shiftController.getShiftsByDateRange(startDate, endDate);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear turno
router.post('/', async (req, res) => {
    try {
        const newShift = await shiftController.createShift(req.body);
        res.status(201).json(newShift);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar turno
router.put('/:id_shift', async (req, res) => {
    try {
        const updatedShift = await shiftController.updateShift(req.params.id_shift, req.body);
        res.json(updatedShift);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar turno
router.delete('/:id_shift', async (req, res) => {
    try {
        await shiftController.deleteShift(req.params.id_shift);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;