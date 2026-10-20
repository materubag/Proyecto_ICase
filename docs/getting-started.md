# Instalación y desarrollo

## Docker

Desde la raíz, copiar `.env.example` a `.env`, completar las variables necesarias y ejecutar:

```sh
docker compose up --build -d
```

Frontend: `http://localhost:3001`. Backend: `http://localhost:8080/api/health`. Swagger UI: `http://localhost:8080/api/docs/`.

PostgreSQL se publica en el puerto 5433; entre contenedores se utiliza `postgres:5432`. El arranque ejecuta `prisma db push --skip-generate`. Revisar los cambios del esquema y respaldar la base antes de actualizar una instalación con datos.

## Desarrollo local

Requiere Node.js compatible con las dependencias y PostgreSQL disponible. Configurar `DATABASE_URL` antes de iniciar el backend.

```sh
cd backend
npm ci
npm run prisma:generate
npm start
```

En otra terminal:

```sh
cd frontend
npm ci
npm run dev
```

No incluir `.env`, documentos de usuarios, audios ni credenciales en los commits.
