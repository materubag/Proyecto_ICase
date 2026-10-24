/**
 * Docker Generator
 * Produces Dockerfile for backend, docker-compose.yml (DB + Backend + Frontend) and .dockerignore
 */

function generateDockerfile() {
  return `# Dockerfile para API Node.js + Express
# Generado automáticamente por ICASE Studio
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para aprovechar el cache de capas
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código de la aplicación
COPY . .

# Puerto expuesto para el backend
EXPOSE 8080

# Comando de inicio
CMD ["npm", "start"]
`;
}

function generateDockerCompose(projectName = 'app') {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  return `# Docker Compose Full-Stack para ${projectName}
# Generado automáticamente por ICASE Studio
# Ejecutar: docker compose up --build -d

services:
  # 1. Base de Datos PostgreSQL
  db:
    image: postgres:15-alpine
    container_name: ${safeName}_postgres
    restart: always
    environment:
      POSTGRES_DB: \${DB_NAME:-${safeName}_db}
      POSTGRES_USER: \${DB_USER:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-postgres123}
    ports:
      - "\${DB_PORT:-5435}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres} -d \${DB_NAME:-${safeName}_db}"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 2. Backend REST API (Express + Sequelize)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${safeName}_backend
    restart: always
    ports:
      - "\${BACKEND_PORT:-8085}:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: \${DB_NAME:-${safeName}_db}
      DB_USER: \${DB_USER:-postgres}
      DB_PASSWORD: \${DB_PASSWORD:-postgres123}
    depends_on:
      db:
        condition: service_healthy

  # 3. Frontend Web SPA (React + Vite + Nginx)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ${safeName}_frontend
    restart: always
    ports:
      - "\${FRONTEND_PORT:-3005}:80"
    depends_on:
      - backend

volumes:
  postgres_data:
`;
}

function generateDockerIgnore() {
  return `node_modules
npm-debug.log
.git
.gitignore
.env
dist
build
`;
}

module.exports = {
  generateDockerfile,
  generateDockerCompose,
  generateDockerIgnore
};
