// Script de prueba para verificar configuración de cookies
import dotenv from 'dotenv';

// Cargar variables según el entorno
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
dotenv.config({ path: envFile });

console.log('\n🔍 DIAGNÓSTICO DE CONFIGURACIÓN DE COOKIES\n');
console.log('==========================================\n');

console.log('📋 Variables de entorno:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`  PORT: ${process.env.PORT || '3001'}`);
console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ NO configurado'}`);
console.log(`  REFRESH_TOKEN_SECRET: ${process.env.REFRESH_TOKEN_SECRET ? '✅ Configurado' : '❌ NO configurado'}`);

console.log('\n🍪 Configuración de cookies según NODE_ENV:\n');

const getCookieConfig = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/'
});

const config = getCookieConfig();

console.log('  httpOnly:', config.httpOnly ? '✅ true' : '❌ false');
console.log('  secure:', config.secure ? '✅ true (requiere HTTPS)' : '❌ false');
console.log('  sameSite:', config.sameSite);
console.log('  path:', config.path);

console.log('\n⚠️  IMPORTANTE PARA PRODUCCIÓN:\n');

if (process.env.NODE_ENV === 'production') {
  console.log('  ✅ NODE_ENV=production detectado');
  console.log('  ✅ sameSite=none (permite cross-domain)');
  console.log('  ✅ secure=true (requiere HTTPS)');
  console.log('\n  📌 Verifica que:');
  console.log('     1. El backend use HTTPS (https://ticketera.fabbiodv.com)');
  console.log('     2. CORS incluya: https://admin-ticketera.vercel.app');
  console.log('     3. El frontend use: credentials: "include"');
} else {
  console.log('  ⚠️  NODE_ENV no es "production"');
  console.log('  ⚠️  sameSite=lax (NO funciona cross-domain)');
  console.log('  ⚠️  secure=false (cookies sin HTTPS)');
  console.log('\n  ❌ ESTO NO FUNCIONARÁ EN PRODUCCIÓN');
  console.log('     Asegúrate de configurar NODE_ENV=production en el servidor');
}

console.log('\n==========================================\n');
