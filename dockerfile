# Imagen base ligera
FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché
COPY package.json package-lock.json ./

# Instalar solo dependencias de producción
RUN npm install --production

# Copiar el resto del código
COPY . .

# Exponer el puerto 8080
EXPOSE 8080

# Comando de inicio
CMD ["node", "index.js"]