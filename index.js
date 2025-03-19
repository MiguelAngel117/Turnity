const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

require('dotenv/config');
const pool = require('./src/connect/connection');

const PORT = 3000;

app.use(cors());
app.options('*', cors());

//Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('tiny'));
app.use(require('./src/routes/globalRoutes'));

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Ready! 🚀, Server running http://localhost:${PORT}`);
});

// Ruta base
app.get('/', (req, res) => {
  res.send("La App está corriendo👀👍🚀🚀").status(200);
});

const shutdown = async () => {
  console.log('🛑 Cerrando el pool de conexiones a la base de datos...');
  try {
    try {
      const killConnectionsQuery = `
        SELECT CONCAT('KILL ', id, ';') 
        FROM information_schema.processlist 
        WHERE user = 'uaop1cnrfizjl7m8';
      `;
      const killUserConnectionsProcedure = `
        CALL KillUserConnections('uaop1cnrfizjl7m8');
      `;

      // Ejecutar la primera consulta
      const [killConnectionsResult] = await pool.query(killConnectionsQuery);
      console.log('🔄 Conexiones a eliminar:', killConnectionsResult);

      // Ejecutar el procedimiento almacenado
      const [killProcedureResult] = await pool.query(killUserConnectionsProcedure);
      console.log('✅ Procedimiento ejecutado:', killProcedureResult);
    } catch (error) {
      console.error('❌ Error al ejecutar las consultas de cierre:', error);
    }
      await pool.end(); // Cierra todas las conexiones del pool
      console.log('✅ Todas las conexiones liberadas.');
  } catch (error) {
      console.error('❌ Error al cerrar conexiones:', error);
  } finally {
      process.exit(0); // Cerrar el proceso de Node.js
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown); 
process.on('uncaughtException', async (err) => {
  console.error('❌ Error no controlado:', err);
  await shutdown();
});
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Promesa rechazada sin manejar:', promise, 'Razón:', reason);
  await shutdown();
});