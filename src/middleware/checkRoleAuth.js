const { verifyToken } = require('../helpers/generateToken');
const pool = require('../connect/connection');

const checkRoleAuth = (roles) => async (req, res, next) => {
    try {
        // Verificar si hay un token en los headers
        if (!req.headers.authorization) {
            return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
        }

        const token = req.headers.authorization.split(' ').pop();
        const tokenData = await verifyToken(token);

        if (!tokenData) {
            return res.status(401).json({ error: 'TOKEN EXPIRED' });
        }

        // Obtener los roles del usuario desde la base de datos
        const [userRoles] = await pool.execute(
            'SELECT role_name FROM User_Role WHERE number_document = ?',
            [tokenData.number_document]
        );

        // Verificar si el usuario tiene al menos uno de los roles requeridos
        const userRoleNames = userRoles.map(r => r.role_name);
        const hasRequiredRole = [].concat(roles).some(role => userRoleNames.includes(role));

        if (hasRequiredRole) {
            // Almacenar los datos del usuario en el request
            req.user = {
                ...tokenData,
                roles: userRoleNames
            };
            next();
        } else {
            res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
        }
    } catch (error) {
        console.error("Error en la validación del Rol:", error);
        res.status(500).json({ error: 'Error en la validación del Rol' });
    }
};

module.exports = checkRoleAuth;