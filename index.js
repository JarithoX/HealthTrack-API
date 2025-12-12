const express = require('express');
const cors = require('cors');
require('dotenv').config();

const usuariosRoutes = require('./routes/usuarios.routes');
const habitosRoutes = require('./routes/habitos.routes');
const authRoutes = require('./routes/auth.routes');
const habitosRecomendadosRoutes = require('./routes/habitos_recomendados.routes');
const chatRoutes = require('./routes/chat.routes');
const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({ origin: ['http://localhost:8000'], credentials: true }));
app.use(express.json());


// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', habitosRoutes);
app.use('/api/habitos-recomendados', habitosRecomendadosRoutes);

// ping opcional
app.get('/', (_req, res) => res.status(200).send('API HealthTrack funcionando'));

// Middleware para manejar 404 (Debe ir al final)
app.use((req, res, next) => {
    console.log(`[404] Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server corriendo en http://localhost:${PORT}`);
    console.log('Rutas disponibles:');
    console.log(`- http://localhost:${PORT}/api/auth`);
    console.log(`- http://localhost:${PORT}/api/usuarios`);
    console.log(`- http://localhost:${PORT}/api/chat`);
    console.log(`- http://localhost:${PORT}/api/habitos`);
});