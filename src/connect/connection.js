/*const mysql = require('mysql2/promise');

// Configuración de la conexión
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  port: 3306,
  database: 'nombre_de_tu_base_de_datos', // Reemplaza con tu base de datos
  authPlugin: 'caching_sha2_password',
  connectionLimit: 10 // Número de conexiones en el pool
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para ejecutar consultas
async function executeQuery(query, params = []) {
  try {
    const [results] = await pool.execute(query, params);
    console.log('Conexión a la base de datos establecida con éxito 🚀');
    return results;
  } catch (error) {
    console.error('Error en la consulta:', error);
    throw error;
  }
}

// Exportar funciones útiles
module.exports = {
  pool,
  executeQuery
};*/

const mysql = require('mysql2/promise');

// Configuración de la conexión
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'turnity',
    connectionLimit: 20,
    authPlugin: 'caching_sha2_password'
});

pool.getConnection()
    .then(connection => {
        console.log('Conexión a la base de datos establecida con éxito 🚀');
        connection.release();
    })
    .catch(error => {
        console.error('Error en la conexión a la base de datos:', error);
    });

module.exports = pool;