const express = require('express');
const cors = require('cors');
require('dotenv').config();

const usuariosRoutes = require('./routes/usuarios.routes');
const habitosRoutes = require('./routes/habitos.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({ origin: ['http://localhost:8000'], credentials: true }));
app.use(express.json());


// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api', habitosRoutes);

// ping opcional
app.get('/', (_req, res) => res.status(200).send('API HealthTrack funcionando'));

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Server corriendo en http://localhost:${PORT}`);
    console.log('Rutas disponibles:');
    console.log(`- http://localhost:${PORT}/api/auth`);
    console.log(`- http://localhost:${PORT}/api/usuarios`);
    console.log(`- http://localhost:${PORT}/api/habitos`);
});