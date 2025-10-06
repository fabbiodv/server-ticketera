import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET no encontrado');
  process.exit(1);
}

async function getUsersFromDB() {
  try {
    // Obtener usuarios reales de la base de datos
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'admin@ticketera.com',
            'carlos@musicpro.com', 
            'maria@eventoslive.com',
            'ana@musicpro.com',
            'sofia@musicpro.com',
            'luis@eventoslive.com'
          ]
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        profiles: {
          include: {
            roles: true,
            productora: {
              select: { name: true, code: true }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    if (users.length === 0) {
      console.error('No se encontraron usuarios. ¿Ejecutaste el seeder?');
      console.log('💡 Ejecuta: npm run seed');
      process.exit(1);
    }

    return users;
  } catch (error) {
    console.error('Error conectando a la base de datos:', error.message);
    process.exit(1);
  }
}

function generateToken(userId, expiresIn = '24h') {
  return jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn });
}

async function main() {
  console.log('🔍 Obteniendo usuarios reales de la base de datos...\n');
  
  const users = await getUsersFromDB();
  
  console.log('TOKENS GENERADOS CON IDS REALES:\n');
  
  users.forEach(user => {
    const token = generateToken(user.id);
    const roles = user.profiles.flatMap(p => p.roles.map(r => r.role));
    const productora = user.profiles[0]?.productora?.name || 'Sin productora';
    
    console.log(`📧 ${user.email}`);
    console.log(`👤 ${user.name} (ID: ${user.id})`);
    console.log(`🏢 ${productora}`);
    console.log(`👑 Roles: ${roles.join(', ') || 'Sin roles'}`);
    console.log(`🔑 Token: Bearer ${token}\n`);
  });

  // Token de prueba rápido
  const adminUser = users.find(u => u.email === 'admin@ticketera.com');
  if (adminUser) {
    const adminToken = generateToken(adminUser.id);
    console.log('PARA COPIAR Y PEGAR (ADMIN):');
    console.log(`Authorization: Bearer ${adminToken}\n`);
    
    console.log('🚀 EJEMPLO DE PRUEBA:');
    console.log(`curl -X GET "http://localhost:3001/auth/me" \\`);
    console.log(`  -H "Authorization: Bearer ${adminToken}"`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);