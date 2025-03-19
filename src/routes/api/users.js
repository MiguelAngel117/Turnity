const express = require('express');
const userController = require('../../controllers/userController');
const checkAuth = require('../../middleware/checkAuth');
const checkRoleAuth = require('../../middleware/checkRoleAuth');
const router = express.Router();

// Ruta para login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(409).json({ error: 'Email y contraseña son requeridos' });
        }
        const userData = await userController.loginUser(identifier, password);
        res.json(userData);
    } catch (error) {
        res.status(409).json({ error: error.message });
    }
});

// Ruta para registro de usuario
router.post('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        console.log(req.body);
        const newUser = await userController.createUser(req.body);
        res.status(201).json(newUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener todos los usuarios - solo Administrador
router.get('/', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const users = await userController.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener usuario por número de documento - propio usuario o Administrador
router.get('/:number_document', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const user = await userController.getUserByDocument(req.params.number_document);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario - propio usuario o Administrador
router.put('/:number_document', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const updatedUser = await userController.updateUser(req.params.number_document, req.body);
        res.json(updatedUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Eliminar usuario - solo Administrador
router.delete('/:number_document', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const result = await userController.deleteUser(req.params.number_document);
        if (!result) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(200).json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener roles de un usuario - propio usuario o Administrador
router.get('/:number_document/roles', checkAuth, async (req, res) => {
    try {
        // Verificar si el usuario solicita su propia información o es Administrador
        if (
            req.user.number_document !== req.params.number_document && 
            !req.user.roles.includes('Administrador')
        ) {
            return res.status(403).json({ error: 'No tiene permiso para ver esta información' });
        }

        const roles = await userController.getUserRoles(req.params.number_document);
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Asignar roles
router.post('/:number_document/roles', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const { role_name, stores } = req.body;
        if (!role_name) {
            return res.status(400).json({ error: 'Nombre del rol es requerido' });
        }

        await userController.assignRoleToUser(req.params.number_document, role_name, stores);
        res.status(201).json({ message: 'Rol asignado correctamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:number_document/roles/:role_name', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        await userController.removeRoleFromUser(req.params.number_document, req.params.role_name);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener tiendas a las que tiene acceso un usuario
router.get('/:number_document/stores', checkAuth, async (req, res) => {
    try {
        // Verificar si el usuario solicita su propia información o es Administrador
        if (
            req.user.number_document !== req.params.number_document && 
            !req.user.roles.includes('Administrador')
        ) {
            return res.status(403).json({ error: 'No tiene permiso para ver esta información' });
        }

        const stores = await userController.getUserStores(req.params.number_document);
        res.json(stores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener accesos a tiendas y departamentos
router.get('/:number_document/departments', checkAuth, async (req, res) => {
    try {
        if (
            req.user.number_document !== req.params.number_document && 
            !req.user.roles.includes('Administrador')
        ) {
            return res.status(403).json({ error: 'No tiene permiso para ver esta información' });
        }

        const accessData = await userController.getDepartmentAccess(req.params.number_document);
        res.json(accessData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Quitar acceso a una tienda
router.delete('/:number_document/stores/:id_store', checkAuth, async (req, res) => {
    try {
        await userController.removeStoreAccess(req.params.number_document, req.params.id_store);
        res.json({ success: true, message: 'Acceso a la tienda removido correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Quitar acceso a departamentos
router.delete('/:number_document/stores/:id_store/departments', checkAuth, checkRoleAuth(['Administrador']), async (req, res) => {
    try {
        const { id_departments } = req.body;
        const result = await userController.removeDepartmentAccess(req.params.number_document, req.params.id_store, id_departments);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener departamentos accesibles para un usuario en una tienda
router.get('/:number_document/stores/:id_store/departments', checkAuth, async (req, res) => {
    try {
        const departments = await userController.getUserDepartments(req.params.number_document, req.params.id_store);
        res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;