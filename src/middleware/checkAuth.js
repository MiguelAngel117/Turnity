const { verifyToken } = require('../helpers/generateToken');
const pool = require('../connect/connection');

const checkAuth = async (req, res, next) => {
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

        // Verificar que el usuario existe en la base de datos
        const [users] = await pool.execute(
            'SELECT number_document, status_user FROM Users WHERE number_document = ?',
            [tokenData.number_document]
        );

        if (users.length === 0 || !users[0].status_user) {
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }

        // Almacenar los datos del usuario en el request
        req.user = tokenData;
        next();
    } catch (error) {
        console.log("TOKEN EXPIRED");
        res.status(401).json({ error: 'TOKEN EXPIRED' });
    }
};

module.exports = checkAuth;