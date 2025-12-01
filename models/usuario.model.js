class UsuarioModel {
    /**
     * Valida y limpia los datos para la actualización del perfil.
     */
    static validarPerfilUpdate(data) {
        const sanitizedData = {};
        const allowedFields = [
            'peso', 'altura', 'edad', 'genero',
            'hora_despertar', 'hora_dormir',
            'objetivos', 'condiciones_medicas', 'activo'
        ];

        // Validaciones específicas
        if (data.peso !== undefined) {
            if (typeof data.peso !== 'number' || data.peso < 0) {
                throw new Error("El campo 'peso' debe ser un número positivo.");
            }
            sanitizedData.peso = data.peso;
        }

        if (data.altura !== undefined) {
            if (typeof data.altura !== 'number' || data.altura < 0) {
                throw new Error("El campo 'altura' debe ser un número positivo.");
            }
            sanitizedData.altura = data.altura;
        }

        if (data.edad !== undefined) {
            if (typeof data.edad !== 'number' || data.edad < 0) {
                throw new Error("El campo 'edad' debe ser un número positivo.");
            }
            sanitizedData.edad = data.edad;
        }

        if (data.genero !== undefined) {
            const generosValidos = ['masculino', 'femenino', 'otro'];
            if (!generosValidos.includes(data.genero)) {
                throw new Error("El campo 'genero' debe ser 'masculino', 'femenino' u 'otro'.");
            }
            sanitizedData.genero = data.genero;
        }

        if (data.hora_despertar !== undefined) {
            // Validación formato HH:MM o HH:MM:SS
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(data.hora_despertar)) {
                throw new Error("El campo 'hora_despertar' debe tener el formato HH:MM.");
            }
            // Guardamos siempre como HH:MM para consistencia
            sanitizedData.hora_despertar = data.hora_despertar.substring(0, 5);
        }

        if (data.hora_dormir !== undefined) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
            if (!timeRegex.test(data.hora_dormir)) {
                throw new Error("El campo 'hora_dormir' debe tener el formato HH:MM.");
            }
            // Guardamos siempre como HH:MM para consistencia
            sanitizedData.hora_dormir = data.hora_dormir.substring(0, 5);
        }

        if (data.objetivos !== undefined) {
            if (!Array.isArray(data.objetivos) || !data.objetivos.every(item => typeof item === 'string')) {
                throw new Error("El campo 'objetivos' debe ser un array de cadenas de texto.");
            }
            sanitizedData.objetivos = data.objetivos;
        }

        if (data.condiciones_medicas !== undefined) {
            if (typeof data.condiciones_medicas !== 'string') {
                throw new Error("El campo 'condiciones_medicas' debe ser una cadena de texto.");
            }
            sanitizedData.condiciones_medicas = data.condiciones_medicas;
        }

        if (data.activo !== undefined) {
            if (typeof data.activo !== 'boolean') {
                throw new Error("El campo 'activo' debe ser un valor booleano.");
            }
            sanitizedData.activo = data.activo;
        }

        return sanitizedData;
    }

    /**
     * Valida y limpia los datos para la actualización por parte de un administrador.
     * Permite editar rol, activo y otros campos de perfil.
     */
    static validarAdminUpdate(data) {
        // Reutilizamos la validación de perfil para los campos comunes
        let sanitizedData = this.validarPerfilUpdate(data);

        // Validaciones exclusivas de Admin
        if (data.rol !== undefined) {
            if (typeof data.rol !== 'string') {
                throw new Error("El campo 'rol' debe ser una cadena de texto.");
            }
            sanitizedData.rol = data.rol;
        }

        if (data.activo !== undefined) {
            if (typeof data.activo !== 'boolean') {
                throw new Error("El campo 'activo' debe ser un valor booleano.");
            }
            sanitizedData.activo = data.activo;
        }

        // Aquí podríamos agregar más campos administrativos si fuera necesario (ej. is_staff, etc)

        return sanitizedData;
    }
}

module.exports = UsuarioModel;
