const express = require('express');
const cors = require('cors');
const habitosRoutes = require('./routes/habitos.routes.js');

const app = express();
const PORT = 3000; // Puedes elegir cualquier puerto libre, ej. 3000 o 8080

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend de Django
app.use(express.json()); // Permite que Express lea cuerpos de solicitud en JSON

// Ruta de prueba (Endpoint de la API)
app.get('/', (req, res) => {
    res.status(200).send('API Health Track: Node.js + Express está funcionando.');
});

// Rutas de la API (Endpoints)
// La URL base para esta app será /api/habitos (como se define en el requerimiento)
app.use('/api', habitosRoutes); 

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Server corriendo en http://localhost:${PORT}`);
});