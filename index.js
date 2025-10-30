const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios.routes'); // ← asegúrate de tener esto

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:8000'], credentials: true }));
app.use(express.json());

// si quieres que sigan existiendo ambas rutas:
app.use('/', usuariosRoutes);     // /usuarios

// ping opcional
app.get('/', (_req, res) => res.status(200).send('API HealthTrack funcionando'));

app.listen(PORT, () => console.log(`Server corriendo en http://localhost:${PORT}/usuarios`));
