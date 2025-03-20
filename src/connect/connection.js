require('dotenv').config();
const mysql = require('mysql2/promise');

// Variable global para el pool de conexión
let pool = null;

/**
 * Inicializa el pool de conexión a la base de datos
 * @param {number} connectionType - 0 para conexión en la nube, 1 para conexión local
 * @returns {Promise<Pool>} - El pool de conexión inicializado
 */
async function initializePool(connectionType = 0) {
    try {
        if (connectionType === 0) {
            // Conexión a la nube (cuando connectionType es 0)
            pool = mysql.createPool({
                host: process.env.MYSQL_ADDON_HOST,
                user: process.env.MYSQL_ADDON_USER,
                password: process.env.MYSQL_ADDON_PASSWORD,
                database: process.env.MYSQL_ADDON_DB,
                port: process.env.MYSQL_ADDON_PORT || 3306,
                connectionLimit: 20,
                authPlugin: 'caching_sha2_password'
            });
            
            // Verificar que la conexión a la nube funciona
            const cloudConnection = await pool.getConnection();
            console.log('Conexión a la base de datos en la nube establecida con éxito 🚀');
            cloudConnection.release();
        } else if (connectionType === 1) {
            // Conexión local (cuando connectionType es 1)
            pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'root',
                database: process.env.DB_NAME || 'turnity',
                port: process.env.DB_PORT || 3306,
                connectionLimit: 20,
                authPlugin: 'caching_sha2_password'
            });
            
            // Verificar que la conexión local funciona
            const localConnection = await pool.getConnection();
            console.log('Conexión a la base de datos local establecida con éxito 🚀');
            localConnection.release();
        } else {
            throw new Error('Tipo de conexión inválido. Use 0 para nube o 1 para local.');
        }
    } catch (error) {
        console.error(`Error al conectar a la base de datos (tipo: ${connectionType === 0 ? 'nube' : 'local'}):`, error.message);
        throw error;
    }
    
    return pool;
}

// Inicializar la conexión al cargar el módulo con el tipo especificado
// La aplicación puede importar este módulo directamente y usar el pool
// sin necesidad de inicializarlo manualmente

// Este es el punto donde decides a qué base de datos conectarte (0 o 1)
const connectionType = 1; // Cambia a 1 para usar la conexión local por defecto

// Iniciar la conexión inmediatamente
initializePool(connectionType).catch(err => {
    console.error('Error al inicializar el pool de conexiones:', err);
    process.exit(1); // Terminar el proceso si no se puede conectar
});

// Exportar directamente el objeto pool
module.exports = pool;