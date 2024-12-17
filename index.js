const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

require('dotenv/config');
require('./src/connect/connection');

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