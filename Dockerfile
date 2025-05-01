FROM node:20

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y curl

COPY package.json package-lock.json ./

COPY .env.prod .env.prod

# Instalar dependencias
RUN npm ci --only=production

COPY . .


CMD ["sh", "-c", "npm run db:deploy && npm run start"]