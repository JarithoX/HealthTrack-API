# HealthTrack - Proyecto Final

Esta es la API RESTful central del proyecto HealthTrack, construida con Node.js y Express, y utilizando Firebase Firestore como base de datos.

## 🛠️ Tecnologías
* **Runtime:** Node.js v18+
* **Base de Datos:** Firebase Firestore (NoSQL)
* **Autenticación:** Firebase Admin SDK
* **Despliegue:** Google Cloud Run (Dockerizado)

REPOSITORIO:
```powershell
https://github.com/JarithoX/HealthTrack-API.git
```

## 🚀 Inicio Rápido
Sigue estos pasos para levantar el servidor de la API en tu entorno local.

1. Requisitos Previos
Asegúrate de tener instalado:

- Node.js (versión LTS recomendada).
- npm (Node Package Manager).

2. Configuración de Firebase
Asegúrate de que serviceAccountKey.json este dentro de /config

3. Instalar dependencias
```powershell
npm install
```

4. Ejecutar servidor
```powershell
node index.js
```

## 💻 Desarrollo Local (Cómo ejecutar en tu PC)

### 1. Prerrequisitos
* Tener Node.js instalado.
* Tener el archivo `.env` en la raíz de esta carpeta.

### 2. Configuración de Variables de Entorno (`.env`)
Crea un archivo `.env` con las siguientes claves:
```env
PORT=3000
JWT_SECRET=tu_clave_secreta_local
FIREBASE_API_KEY=AIzaSy...
FIREBASE_PROJECT_ID=health-track-165f2

# Asegúrate de tener el archivo config/serviceAccountKey.json si usas credenciales de servicio
```
## La Arquitectura de Despliegue
Firebase Hosting es el recepcionista:

1. Usuario entra a: tu-app.web.app (Ruta /) -> Firebase deriva a Cloud Run (Django Container).

2. Usuario pide datos a: /api/... -> Firebase deriva a Cloud Run (Node.js Container).

Ambos servicios corren en la infraestructura de Google (escalables y seguros), y el usuario lo ve todo bajo un solo dominio HTTPS.