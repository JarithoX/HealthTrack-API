const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET; 

if (!JWT_SECRET) {
    // Es vital que la clave esté cargada. Si falla, el servidor debe detenerse.
    throw new Error('FATAL: JWT_SECRET no está definido en las variables de entorno. Verifique su archivo .env.');
}

const validarJWT = (req, res, next) => {
    
    // 1. Obtener el token. Se espera que venga en el header 'x-token'.
    // Django debe enviar: headers: {'x-token': token}
    const token = req.header('x-token');

    if (!token) {
        // 401 Unauthorized: No hay token.
        console.log("Falta el token en la peticion")
        return res.status(401).json({
            message: 'Acceso denegado. Se requiere un token de autenticación (x-token).'
        });
    }

    try {
        // 2. Verificar el token usando la clave secreta.
        const payload = jwt.verify(token, JWT_SECRET);
        
        // 3. Inyectar los datos del usuario (del payload) en el request.
        // Estos datos estarán disponibles en los controllers subsiguientes.
        req.uid = payload.uid;
        req.rol = payload.rol;
        req.username = payload.username;
        
        // 4. Continuar con la ejecución de la función del controller.
        next();

    } catch (error) {
        // 401 Unauthorized: El token es inválido (expiró, está mal firmado, etc.).
        console.log("Token invalido o expirado")
        console.error("Error al validar JWT:", error.message);
        return res.status(401).json({
            message: 'Token no válido o expirado.'
        });
    }
};

module.exports = {
    validarJWT
}