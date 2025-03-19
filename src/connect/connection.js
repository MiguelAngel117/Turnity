require('dotenv').config();
const mysql = require('mysql2/promise');

// Intentar primero la conexión en la nube, luego la local
let pool = null;

async function initializePool() {
    try {
        // Primero intentar conectar con la configuración de la nube
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
    } catch (cloudError) {
        console.warn('No se pudo conectar a la base de datos en la nube:', cloudError.message);
        console.log('Intentando conexión local...');
        
        try {
            // Si falla la conexión a la nube, intentar con la configuración local
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
        } catch (localError) {
            console.error('Error en todas las conexiones a la base de datos:');
            console.error('Error en la nube:', cloudError.message);
            console.error('Error local:', localError.message);
            throw new Error('No se pudo establecer conexión con ninguna base de datos');
        }
    }
    
    return pool;
}

// Inicializar la conexión inmediatamente
initializePool().catch(err => {
    console.error('Error al inicializar el pool de conexiones:', err);
    process.exit(1); // Terminar el proceso si no se puede conectar a ninguna base de datos
});

// Exportar directamente el objeto pool
module.exports = pool;