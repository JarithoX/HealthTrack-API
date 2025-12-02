const { admin } = require('../config/firebase'); 


const validarJWT = async (req, res, next) => {
    
    const authHeader = req.headers['authorization'];
    
let token = '';

// 2. Extracción Robusta
    if (authHeader) {
        // Verificamos si empieza con 'bearer ' (ignorando mayúsculas/minúsculas)
        if (authHeader.toLowerCase().startsWith('bearer ')) {
            // Dividimos por el espacio y tomamos la segunda parte
            const parts = authHeader.split(' ');
            if (parts.length === 2) {
                token = parts[1];
            }
        } else {
            // Si no tiene prefijo Bearer, asumimos que es el token directo (raro, pero posible)
            token = authHeader;
        }
    } 
    
    // Fallback: Intentar leer x-token si Authorization falló
    if (!token) {
        token = req.headers['x-token'];
    }

    // 3. Validación de Existencia
    if (!token || token === 'undefined' || token === 'null') {
        console.log("ERROR: No se encontró token válido en la extracción.");
        return res.status(401).json({
            message: 'Acceso denegado. Token no proporcionado o formato incorrecto.'
        });
    }

    try {
        // 4. Verificación con Firebase Admin (Clave Pública de Google)
        // ESTO ES CRÍTICO: Usamos admin.auth(), NO jwt.verify()
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // 5. Inyectar datos al request
        req.uid = decodedToken.uid;
        req.email = decodedToken.email;
        
        next();

    } catch (error) {
        console.error("ERROR VERIFICACIÓN FIREBASE:", error.code, error.message);
        
        // Manejo específico de errores
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ message: 'El token ha expirado. Por favor, inicie sesión nuevamente.' });
        }
        
        return res.status(401).json({
            message: 'Token no válido.'
        });
    }
};

module.exports = {
    validarJWT
}