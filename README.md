# A tener en consideracion:

## Comandos utiles:
- npx prisma generate
- npx prisma db push
- npx prisma studio

## Docker en development
sudo docker-compose up --build

## Docker en production
sudo docker-compose --env-file .env.prod -f docker-compose.prod.yml up --build