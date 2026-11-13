/**
 * Docker Generator
 * Produces Dockerfile for backend, docker-compose.yml (DB + Backend + Frontend) and .dockerignore
 */

function generateDockerfile() {
  return `# Dockerfile para API Node.js + Express
# Generado y auditado conforme a estándares de seguridad ICASE Studio (Node 20, USER node, HEALTHCHECK)
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000

# Crear directorio para subidas y asignar permisos al usuario node
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copiar el código con propiedad del usuario sin privilegios root
COPY --chown=node:node . .

# Seguridad: Ejecutar como usuario 'node' no-root
USER node

# Puerto expuesto para el backend
EXPOSE 8080

# Comprobación de salud interna
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://127.0.0.1:8080/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Comando de inicio
CMD ["npm", "start"]
`;
}

function generateDockerCompose(projectName = 'app') {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  return `# Docker Compose Full-Stack para ${projectName}
# Generado y asegurado conforme a dictamen de auditoría ICASE Studio (PostgreSQL 16, Red Aislada, USER node)
# Ejecutar: docker compose up --build -d

services:
  # 1. Base de Datos Relacional PostgreSQL 16
  db:
    image: postgres:16-alpine
    container_name: ${safeName}_postgres
    restart: always
    environment:
      POSTGRES_DB: \${DB_NAME:-${safeName}_db}
      POSTGRES_USER: \${DB_USER:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:?DB_PASSWORD es requerida en .env}
    ports:
      - "127.0.0.1:\${DB_PORT:-5435}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ${safeName}_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres} -d \${DB_NAME:-${safeName}_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  # 2. Backend REST API (Express + Sequelize)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${safeName}_backend
    restart: always
    command: sh -c "node src/migrate.js && node src/server.js"
    ports:
      - "127.0.0.1:\${BACKEND_PORT:-8085}:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: \${DB_NAME:-${safeName}_db}
      DB_USER: \${DB_USER:-postgres}
      DB_PASSWORD: \${DB_PASSWORD:?DB_PASSWORD es requerida en .env}
      JWT_SECRET: \${JWT_SECRET:?JWT_SECRET es requerida en .env}
      JWT_EXPIRATION: \${JWT_EXPIRATION:-8h}
      INITIAL_ADMIN_USER: \${INITIAL_ADMIN_USER:-admin}
      INITIAL_ADMIN_EMAIL: \${INITIAL_ADMIN_EMAIL:-admin@${safeName}.com}
      INITIAL_ADMIN_PASSWORD: \${INITIAL_ADMIN_PASSWORD:?INITIAL_ADMIN_PASSWORD es requerida en .env}
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ${safeName}_network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:8080/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

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
      backend:
        condition: service_healthy
    networks:
      - ${safeName}_network

volumes:
  postgres_data:
  uploads_data:

networks:
  ${safeName}_network:
    driver: bridge
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
