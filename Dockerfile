FROM node:20

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN apt-get update && apt-get install -y curl

CMD ["sh", "-c", "npm run db:deploy && npm run start"]
