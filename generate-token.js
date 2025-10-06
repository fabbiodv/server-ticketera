import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// ID de usuarios del seeder (puedes cambiar estos)
const USERS = {
  admin: 289,      // admin@ticketera.com
  carlos: 290,     // carlos@musicpro.com (OWNER Music Pro)
  maria: 293,      // maria@eventoslive.com (OWNER Eventos Live)
  ana: 294,        // ana@musicpro.com (LIDER + QR)
  sofia: 295       // sofia@musicpro.com (PUBLICA + QR)
};

function generateToken(userId, expiresIn = '24h') {
  return jwt.sign(
    { userId: userId },
    JWT_SECRET,
    { expiresIn }
  );
}

console.log('🔑 TOKENS GENERADOS:\n');

Object.entries(USERS).forEach(([name, userId]) => {
  const token = generateToken(userId);
  console.log(`${name.toUpperCase()} (ID: ${userId}):`);
  console.log(`Bearer ${token}\n`);
});

const mariaToken = generateToken(USERS.maria);
console.log('📋 PARA COPIAR Y PEGAR EN CURL:');
console.log(`Authorization: Bearer ${mariaToken}\n`);

console.log('🚀 EJEMPLO DE USO:');
console.log(`curl -X GET "http://localhost:3001/eventos/my-eventos" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "Authorization: Bearer ${mariaToken}"`);