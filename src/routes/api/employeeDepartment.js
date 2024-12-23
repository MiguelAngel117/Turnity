const express = require('express');
const router = express.Router();
const EmployeeDepartmentController = require('../../controllers/employeeDepController');
const controller = new EmployeeDepartmentController();

router.get('/', async (req, res) => {
    try {
        const results = await controller.getAll();
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:document', async (req, res) => {
    try {
        const result = await controller.getByDocument(req.params.document);
        if (!result) return res.status(404).json({ message: 'No encontrado' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener todas las personas por sucursal
router.get('/store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const employees = await controller.getByStore(storeId);
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener todas las personas por sucursal y departamento
router.get('/store/:storeId/department/:departmentId', async (req, res) => {
    try {
        const { storeId, departmentId } = req.params;
        const employees = await controller.getByStoreAndDepartment(storeId, departmentId);
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener todas las personas por sucursal, departamento y posición
router.get('/store/:storeId/department/:departmentId/position/:positionId', async (req, res) => {
    try {
        const { storeId, departmentId, positionId } = req.params;
        const employees = await controller.getByStoreDepartmentAndPosition(storeId, departmentId, positionId);
        res.status(200).json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:document', async (req, res) => {
    try {
        const empDept = new EmployeeDepartment(
            req.params.document,
            req.body.id_store_dep,
            req.body.id_position
        );
        const result = await controller.update(empDept);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:document', async (req, res) => {
    try {
        await controller.delete(req.params.document);
        res.json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;