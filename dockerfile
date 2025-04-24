FROM node:20-alpine

WORKDIR /app

# Instalar PM2 globalmente
RUN npm install pm2 -g

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Generar cliente de Prisma
RUN npx prisma generate

# Exponer el puerto que usa la aplicación
EXPOSE 3000

# Usar PM2 en modo runtime (optimizado para contenedores)
CMD ["pm2-runtime", "start", "--env", "production", "src/app.js"]