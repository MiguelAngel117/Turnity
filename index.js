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
    // Matar conexiones activas del usuario
    const killConnectionsQuery = `
      SELECT CONCAT('KILL ', id, ';') 
      FROM information_schema.processlist 
      WHERE user = 'uaop1cnrfizjl7m8';
    `;
    const killUserConnectionsProcedure = `CALL KillUserConnections('uaop1cnrfizjl7m8');`;

    try {
      const [killConnectionsResult] = await pool.query(killConnectionsQuery);
      console.log('🔄 Conexiones a eliminar:', killConnectionsResult);

      const [killProcedureResult] = await pool.query(killUserConnectionsProcedure);
      console.log('✅ Procedimiento ejecutado:', killProcedureResult);
    } catch (error) {
      console.error('❌ Error al ejecutar las consultas de cierre:', error);
    }

    // Esperar a que todas las conexiones del pool se cierren
    await pool.end();
    console.log('✅ Todas las conexiones liberadas.');
  } catch (error) {
    console.error('❌ Error al cerrar conexiones:', error);
  }

  console.log('🚪 Saliendo del proceso de Node.js...');
  process.exit(0);
};

// Escuchar señales del sistema y errores
const exitEvents = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'];

exitEvents.forEach(event => {
  process.on(event, async (...args) => {
    console.error(`❌ Evento capturado (${event}):`, args[0] || '');
    await shutdown();
  });
});
