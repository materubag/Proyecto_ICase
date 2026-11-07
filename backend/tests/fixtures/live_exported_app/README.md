# Hospital San Lucas — Sistema Full-Stack Generado por ICASE Studio

Este proyecto fue generado automáticamente a partir de la especificación común validada y aprobada por el equipo de ingeniería en software.

## Arquitectura

- **Frontend:** React 18, Vite, Single Page Application (SPA), Fetch Client.
- **Backend:** Node.js, Express, Rutas RESTful, Middlewares de validación.
- **Base de Datos:** PostgreSQL con Sequelize ORM y migraciones versionadas.
- **Contenedores:** Docker Compose con soporte multi-servicio y redes aisladas.

## Módulos y Entidades de Datos

- **Rol**: /api/rol
- **Usuario**: /api/usuario
- **Paciente**: /api/paciente

## Instrucciones de Ejecución

### Opción 1: Con Docker Compose (Recomendado)

```bash
docker compose up --build
```

- Frontend disponible en: `http://localhost:3000`
- Backend API disponible en: `http://localhost:8080/api`
- PostgreSQL en puerto: `5432`

### Opción 2: Ejecución Local

1. **Configurar la Base de Datos:**
   Asegúrate de tener PostgreSQL corriendo y crea la base de datos indicada en `backend/.env`.

2. **Iniciar el Backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npm run dev
   ```

3. **Iniciar el Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
