FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy source code
COPY . .

# Grant execute permissions to entrypoint script
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
