const express = require('express');
const moment = require('moment');
const shiftController = require('../../controllers/employeeShiftController');
const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const { 
            storeId, 
            departmentId,
            numWeeks,
            employeeShifts 
        } = req.body;

        // Validaciones básicas (mantener las mismas)
        if (!storeId || !departmentId || !employeeShifts) {
            return res.status(400).json({ 
                success: false,
                message: 'Todos los campos son requeridos',
                data: null
            });
        }

        const result = await shiftController.generateShifts(
            storeId,
            departmentId,
            numWeeks,
            employeeShifts
        );

        return res.status(result.status || (result.success ? 201 : 400)).json({
            success: result.success,
            message: result.message,
            results: result.results,
            errors: result.errors
        });

    } catch (error) {
        console.error('Error en la ruta de creación de turnos:', error);
        return res.status(500).json({ 
            success: false,
            message: error.message || 'Error interno del servidor',
            data: null
        });
    }
});

router.post('/by-employee-list', async (req, res) => {
    try {
        const { employees, startDate, endDate, numWeeks } = req.body;
        const result = await shiftController.getShiftsByEmployeeList(employees, startDate, endDate, numWeeks);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({ message: result.message });
    }
});


router.get('/employee-shifts', async (req, res) => {
    try {
        const { store, department, report } = req.query;
        let reportF = report === 'true' ? true : false;
        const result = await shiftController.getAllEmployeeShifts(store, department, reportF);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});


router.get('/', async (req, res) => {
    try {
        const result = await shiftController.getAllShifts();
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.get('/date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren las fechas de inicio y fin',
                data: null
            });
        }

        const result = await shiftController.getShiftsByDateRange(startDate, endDate);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const result = await shiftController.getShiftById(req.params.id);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.post('/generate-weeks', async (req, res) => {
    const { date } = req.body;

    if (!date || !moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({
            success: false,
            message: 'Fecha inválida o faltante. Use el formato YYYY-MM-DD',
            data: null
        });
    }

    try {
        const weeks = await shiftController.generateWeeksPerMonth(date);
        return res.status(200).json({
            success: true,
            message: 'Semanas generadas exitosamente',
            data: { weeks }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.put('/', async (req, res) => {
    try {
        const {date, employees} = req.body;
        const result = await shiftController.updateShifts(date, employees);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await shiftController.deleteShift(req.params.id);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.delete('/', async (req, res) => {
    try {
        const result = await shiftController.deleteAllShifts();
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.get('/employee/:number_document', async (req, res) => {
    try {
        const result = await shiftController.getShiftsByEmployee(req.params.number_document);
        return res.status(result.status).json({
            success: result.status < 400,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

module.exports = router;