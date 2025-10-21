# A tener en consideracion:

## Comandos utiles:
- npx prisma generate
- npx prisma db push
- npx prisma studio

## Docker en development para la base de datos
sudo docker-compose -f docker-compose.dev.yml up -d

## Docker en production
sudo docker-compose --env-file .env.prod -f docker-compose.prod.yml up --build

test ci cd
