const express = require('express');
const shiftController = require('../../controllers/shiftsController');
const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const { 
            storeId, 
            departmentId, 
            positionId, 
            startDate,
            employeeShifts 
        } = req.body;

        // Validaciones básicas
        if (!storeId || !departmentId || !positionId || !startDate || !employeeShifts) {
            return res.status(400).json({ 
                error: 'Todos los campos son requeridos: storeId, departmentId, positionId, startDate, employeeShifts' 
            });
        }

        // Validar formato de fecha
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate)) {
            return res.status(400).json({
                error: 'El formato de fecha debe ser YYYY-MM-DD'
            });
        }

        const shifts = await shiftController.generateShifts(
            storeId,
            departmentId,
            positionId,
            startDate,
            employeeShifts
        );

        res.json({
            totalShifts: shifts.length,
            shifts
        });

    } catch (error) {
        console.error('Error en la ruta de creación de turnos:', error);
        res.status(500).json({ 
            error: error.message || 'Error interno del servidor'
        });
    }
});

// Rutas para operaciones CRUD básicas
router.get('/', async (req, res) => {
    try {
        const shifts = await shiftController.getAllShifts();
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const shifts = await shiftController.getShiftsByDateRange(startDate, endDate);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const shift = await shiftController.getShiftById(req.params.id);
        if (!shift) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        res.json(shift);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const newShift = await shiftController.createShift(req.body);
        res.status(201).json(newShift);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedShift = await shiftController.updateShift(req.params.id, req.body);
        if (!updatedShift) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        res.json(updatedShift);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await shiftController.deleteShift(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/', async (req, res) => {
    try {
        await shiftController.deleteAllShifts();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas para funcionalidades específicas
router.get('/employee/:number_document', async (req, res) => {
    try {
        const shifts = await shiftController.getShiftsByEmployee(req.params.number_document);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;