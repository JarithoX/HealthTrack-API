const { admin } = require('../config/firebase'); 


const validarJWT = async (req, res, next) => {
    
    const authHeader = req.headers['authorization'];
    
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else {
        token = req.header('x-token');
    }

    if (!token) {
        return res.status(401).json({
            message: 'Acceso denegado. Se requiere header Authorization.'
        });
    }

    try {
        // Esto verifica la firma RS256 usando las llaves de Google automáticamente.
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Inyectar datos en el request
        req.uid = decodedToken.uid;
        req.email = decodedToken.email;
        
        // NOTA: Los tokens de Firebase NO traen 'rol' ni 'username' por defecto,        
        next();

    } catch (error) {
        console.error("Error al validar token Firebase:", error.code, error.message);
        return res.status(401).json({
            message: 'Token no válido o expirado.'
        });
    }
};

module.exports = {
    validarJWT
}