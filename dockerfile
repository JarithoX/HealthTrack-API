# Imagen base 
FROM node:18

# Crear directorio de trabajo
 WORKDIR /app 
 # Copiar archivos 
 COPY package*.json ./ RUN npm install --production COPY . . 
 # Exponer el puerto 
 EXPOSE 8080 # Comando de inicio CMD ["node", "index.js"]