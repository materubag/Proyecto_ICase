FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat chromium nss freetype harfbuzz ca-certificates ttf-freefont docker-cli docker-cli-compose

ENV CODEGEN_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 && npm ls --depth=0
RUN npx prisma generate

# Copy source code
COPY . .

# Ensure LF line endings and grant execute permissions
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
