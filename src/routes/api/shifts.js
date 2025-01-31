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

router.get('/list/', async (req, res) => {
    try {
        const list = await shiftController.getFilteredShifts();
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/breaks/:code_shift', async (req, res) => {
    try {
        const code_shift = req.params.code_shift;
        const breaks = await shiftController.getShiftBreaks(code_shift);
        res.json({ code_shift, breaks });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
})

// GET: Obtener turno por código
router.get('/:code_shift', async (req, res) => {
    try {
        const shift = await shiftController.getShiftByCode(req.params.code_shift);
        if (!shift) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        res.json(shift);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/by-hours/:hours', async (req, res) => {
    try {
        const hours = parseInt(req.params.hours); // Convertir a número
        const shifts = await shiftController.getShiftsByHours(hours);

        if (shifts.length === 0) {
            return res.status(404).json({ message: 'No se encontraron turnos con las horas proporcionadas' });
        }

        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Crear múltiples turnos
router.post('/bulk', async (req, res) => {
    try {
        const result = await shiftController.createMultipleShifts(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT: Actualizar turno
router.put('/:code_shift', async (req, res) => {
    try {
        const updatedShift = await shiftController.updateShift(req.params.code_shift, req.body);
        res.json(updatedShift);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE: Eliminar turno
router.delete('/:code_shift', async (req, res) => {
    try {
        await shiftController.deleteShift(req.params.code_shift);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Eliminar turnoS
router.delete('/', async (req, res) => {
    try {
        await shiftController.deleteAllShifts();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
