# Dockerfile para API Node.js + Express
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
