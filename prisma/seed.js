import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Función para generar QR único para vendedores
const generateVendedorQR = () => {
  return `VND-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
};

// Función para generar QR único para entradas
const generateEntradaQR = () => {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

async function main() {
  console.log('🌱 Iniciando seeder...');

  console.log('🧹 Limpiando base de datos...');
  
  await prisma.entrada.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.tipoEntrada.deleteMany({});
  await prisma.eventos.deleteMany({});
  await prisma.roleAsignee.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.productora.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('✅ Base de datos limpia');

  // 1. Crear usuarios
  console.log('👤 Creando usuarios...');
  
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const users = await Promise.all([
    // Superadmin
    prisma.user.create({
      data: {
        name: 'Admin Sistema',
        email: 'admin@ticketera.com',
        password: hashedPassword
      }
    }),
    // Owners de productoras
    prisma.user.create({
      data: {
        name: 'Carlos Rodriguez',
        email: 'carlos@musicpro.com',
        password: hashedPassword
      }
    }),
    prisma.user.create({
      data: {
        name: 'Maria Gonzalez',
        email: 'maria@eventoslive.com',
        password: hashedPassword
      }
    }),
    // Líderes
    prisma.user.create({
      data: {
        name: 'Ana Martinez',
        email: 'ana@musicpro.com',
        password: hashedPassword
      }
    }),
    prisma.user.create({
      data: {
        name: 'Luis Fernandez',
        email: 'luis@eventoslive.com',
        password: hashedPassword
      }
    }),
    // Públicas
    prisma.user.create({
      data: {
        name: 'Sofia Herrera',
        email: 'sofia@musicpro.com',
        password: hashedPassword
      }
    }),
    prisma.user.create({
      data: {
        name: 'Diego Lopez',
        email: 'diego@musicpro.com',
        password: hashedPassword
      }
    }),
    // SubPúblicas
    prisma.user.create({
      data: {
        name: 'Laura Torres',
        email: 'laura@eventoslive.com',
        password: hashedPassword
      }
    }),
    prisma.user.create({
      data: {
        name: 'Pablo Ruiz',
        email: 'pablo@eventoslive.com',
        password: hashedPassword
      }
    }),
    // Compradores
    prisma.user.create({
      data: {
        name: 'Juan Perez',
        email: 'juan@gmail.com',
        password: hashedPassword
      }
    }),
    prisma.user.create({
      data: {
        name: 'Valentina Silva',
        email: 'valentina@gmail.com',
        password: hashedPassword
      }
    })
  ]);

  console.log(`✅ ${users.length} usuarios creados`);

  // 2. Crear productoras
  console.log('🏢 Creando productoras...');
  
  const productoras = await Promise.all([
    prisma.productora.create({
      data: {
        name: 'Music Pro Productions',
        email: 'info@musicpro.com',
        code: 'MUSICPRO001',
        totalEvents: 0,
        activeEvents: 0,
        totalOrganizers: 0,
        totalRevenue: 0,
        status: 'activa'
      }
    }),
    prisma.productora.create({
      data: {
        name: 'Eventos Live',
        email: 'contacto@eventoslive.com',
        code: 'EVLIVE002',
        totalEvents: 0,
        activeEvents: 0,
        totalOrganizers: 0,
        totalRevenue: 0,
        status: 'activa'
      }
    })
  ]);

  console.log(`✅ ${productoras.length} productoras creadas`);

  // 3. Crear perfiles y asignar roles
  console.log('👥 Creando perfiles y roles...');
  
  // Perfil SuperAdmin
  const superAdminProfile = await prisma.profile.create({
    data: {
      userId: users[0].id, // Admin Sistema
      productoraId: productoras[0].id, // Asignar a una productora por defecto
    }
  });

  await prisma.roleAsignee.create({
    data: {
      profileId: superAdminProfile.id,
      role: 'SUPERADMIN'
    }
  });

  // Perfiles Music Pro Productions
  const ownerMusicPro = await prisma.profile.create({
    data: {
      userId: users[1].id, // Carlos Rodriguez
      productoraId: productoras[0].id
    }
  });

  await prisma.roleAsignee.create({
    data: {
      profileId: ownerMusicPro.id,
      role: 'OWNER'
    }
  });

  // Líder Music Pro
  const liderMusicPro = await prisma.profile.create({
    data: {
      userId: users[3].id, // Ana Martinez
      productoraId: productoras[0].id,
      qrCode: generateVendedorQR()
    }
  });

  await Promise.all([
    prisma.roleAsignee.create({ data: { profileId: liderMusicPro.id, role: 'LIDER' } }),
    prisma.roleAsignee.create({ data: { profileId: liderMusicPro.id, role: 'PUBLICA' } }),
    prisma.roleAsignee.create({ data: { profileId: liderMusicPro.id, role: 'SUBPUBLICA' } })
  ]);

  // Públicas Music Pro
  const publica1MusicPro = await prisma.profile.create({
    data: {
      userId: users[5].id, // Sofia Herrera
      productoraId: productoras[0].id,
      qrCode: generateVendedorQR()
    }
  });

  await Promise.all([
    prisma.roleAsignee.create({ data: { profileId: publica1MusicPro.id, role: 'PUBLICA' } }),
    prisma.roleAsignee.create({ data: { profileId: publica1MusicPro.id, role: 'SUBPUBLICA' } })
  ]);

  const publica2MusicPro = await prisma.profile.create({
    data: {
      userId: users[6].id, // Diego Lopez
      productoraId: productoras[0].id,
      qrCode: generateVendedorQR()
    }
  });

  await Promise.all([
    prisma.roleAsignee.create({ data: { profileId: publica2MusicPro.id, role: 'PUBLICA' } }),
    prisma.roleAsignee.create({ data: { profileId: publica2MusicPro.id, role: 'SUBPUBLICA' } })
  ]);

  // Perfiles Eventos Live
  const ownerEventosLive = await prisma.profile.create({
    data: {
      userId: users[2].id, // Maria Gonzalez
      productoraId: productoras[1].id
    }
  });

  await prisma.roleAsignee.create({
    data: {
      profileId: ownerEventosLive.id,
      role: 'OWNER'
    }
  });

  // Líder Eventos Live
  const liderEventosLive = await prisma.profile.create({
    data: {
      userId: users[4].id, // Luis Fernandez
      productoraId: productoras[1].id,
      qrCode: generateVendedorQR()
    }
  });

  await Promise.all([
    prisma.roleAsignee.create({ data: { profileId: liderEventosLive.id, role: 'LIDER' } }),
    prisma.roleAsignee.create({ data: { profileId: liderEventosLive.id, role: 'PUBLICA' } }),
    prisma.roleAsignee.create({ data: { profileId: liderEventosLive.id, role: 'SUBPUBLICA' } })
  ]);

  // SubPúblicas Eventos Live
  const subpublica1EventosLive = await prisma.profile.create({
    data: {
      userId: users[7].id, // Laura Torres
      productoraId: productoras[1].id,
      qrCode: generateVendedorQR()
    }
  });

  await prisma.roleAsignee.create({
    data: {
      profileId: subpublica1EventosLive.id,
      role: 'SUBPUBLICA'
    }
  });

  const subpublica2EventosLive = await prisma.profile.create({
    data: {
      userId: users[8].id, // Pablo Ruiz
      productoraId: productoras[1].id,
      qrCode: generateVendedorQR()
    }
  });

  await prisma.roleAsignee.create({
    data: {
      profileId: subpublica2EventosLive.id,
      role: 'SUBPUBLICA'
    }
  });

  console.log('✅ Perfiles y roles creados');

  // 4. Crear eventos
  console.log('🎪 Creando eventos...');
  
  const now = new Date();
  const eventos = await Promise.all([
    // Eventos Music Pro
    prisma.eventos.create({
      data: {
        name: 'Festival Rock Nacional 2025',
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 días
        startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000), // 20:00
        endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 26 * 60 * 60 * 1000), // 02:00
        description: 'El festival de rock nacional más grande del año con las mejores bandas',
        location: 'Estadio Luna Park, Buenos Aires',
        capacity: 8000,
        productoraId: productoras[0].id
      }
    }),
    prisma.eventos.create({
      data: {
        name: 'Concierto Indie Underground',
        date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 días
        startTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000), // 22:00
        endTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000 + 25 * 60 * 60 * 1000), // 01:00
        description: 'Una noche única con los mejores exponentes del indie nacional',
        location: 'Niceto Club, Palermo',
        capacity: 1500,
        productoraId: productoras[0].id
      }
    }),
    // Eventos Eventos Live
    prisma.eventos.create({
      data: {
        name: 'Fiesta Electrónica Summer 2025',
        date: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 días
        startTime: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000), // 23:00
        endTime: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000 + 30 * 60 * 60 * 1000), // 06:00
        description: 'La fiesta electrónica más esperada del verano con DJs internacionales',
        location: 'Costa Salguero, Puerto Madero',
        capacity: 5000,
        productoraId: productoras[1].id
      }
    }),
    prisma.eventos.create({
      data: {
        name: 'Stand Up Comedy Night',
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 días
        startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000), // 21:00
        endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000), // 23:00
        description: 'Una noche llena de risas con los mejores comediantes del país',
        location: 'Teatro Maipo, Microcentro',
        capacity: 800,
        productoraId: productoras[1].id
      }
    })
  ]);

  console.log(`✅ ${eventos.length} eventos creados`);

  // 5. Crear tipos de entrada
  console.log('🎫 Creando tipos de entrada...');
  
  const tiposEntrada = [];

  // Tipos para Festival Rock Nacional
  const tiposRock = await Promise.all([
    prisma.tipoEntrada.create({
      data: {
        nombre: 'General',
        precio: 15000,
        eventoId: eventos[0].id,
        totalEntradas: 5000,
        maximoEntradasPorPersona: 4,
        estado: 'DISPONIBLE',
        disponible: true
      }
    }),
    prisma.tipoEntrada.create({
      data: {
        nombre: 'VIP',
        precio: 35000,
        eventoId: eventos[0].id,
        totalEntradas: 500,
        maximoEntradasPorPersona: 2,
        estado: 'DISPONIBLE',
        disponible: true
      }
    }),
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Backstage',
        precio: 75000,
        eventoId: eventos[0].id,
        totalEntradas: 50,
        maximoEntradasPorPersona: 1,
        estado: 'LIMITADA',
        disponible: true
      }
    })
  ]);

  // Tipos para Concierto Indie
  const tiposIndie = await Promise.all([
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Entrada General',
        precio: 8000,
        eventoId: eventos[1].id,
        totalEntradas: 1200,
        maximoEntradasPorPersona: 6,
        estado: 'DISPONIBLE',
        disponible: true
      }
    }),
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Early Bird',
        precio: 6000,
        eventoId: eventos[1].id,
        totalEntradas: 200,
        maximoEntradasPorPersona: 2,
        estado: 'AGOTADA',
        disponible: false
      }
    })
  ]);

  // Tipos para Fiesta Electrónica
  const tiposElectronica = await Promise.all([
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Dance Floor',
        precio: 12000,
        eventoId: eventos[2].id,
        totalEntradas: 3500,
        maximoEntradasPorPersona: 4,
        estado: 'DISPONIBLE',
        disponible: true
      }
    }),
    prisma.tipoEntrada.create({
      data: {
        nombre: 'VIP Lounge',
        precio: 25000,
        eventoId: eventos[2].id,
        totalEntradas: 300,
        maximoEntradasPorPersona: 2,
        estado: 'DISPONIBLE',
        disponible: true
      }
    })
  ]);

  // Tipos para Stand Up
  const tiposStandUp = await Promise.all([
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Platea',
        precio: 4500,
        eventoId: eventos[3].id,
        totalEntradas: 600,
        maximoEntradasPorPersona: 8,
        estado: 'DISPONIBLE',
        disponible: true
      }
    }),
    prisma.tipoEntrada.create({
      data: {
        nombre: 'Palco',
        precio: 7000,
        eventoId: eventos[3].id,
        totalEntradas: 100,
        maximoEntradasPorPersona: 4,
        estado: 'DISPONIBLE',
        disponible: true
      }
    })
  ]);

  tiposEntrada.push(...tiposRock, ...tiposIndie, ...tiposElectronica, ...tiposStandUp);
  console.log(`✅ ${tiposEntrada.length} tipos de entrada creados`);

  // 6. Crear algunas entradas vendidas con pagos
  console.log('💳 Creando entradas vendidas...');
  
  const compradores = [users[9], users[10]]; // Juan y Valentina
  const vendedores = [users[3], users[5], users[4], users[7]]; // Ana, Sofia, Luis, Laura

  const entradas = [];
  const payments = [];

  // Crear algunas ventas de ejemplo
  for (let i = 0; i < 15; i++) {
    const comprador = compradores[Math.floor(Math.random() * compradores.length)];
    const vendedor = vendedores[Math.floor(Math.random() * vendedores.length)];
    const tipoEntrada = tiposEntrada[Math.floor(Math.random() * tiposEntrada.length)];

    const entrada = await prisma.entrada.create({
      data: {
        eventoId: tipoEntrada.eventoId,
        qrCode: generateEntradaQR(),
        escaneado: Math.random() > 0.7, // 30% escaneadas
        tipoEntradaId: tipoEntrada.id,
        buyerId: comprador.id,
        sellerId: vendedor.id
      }
    });

    const payment = await prisma.payment.create({
      data: {
        userId: comprador.id,
        entradaId: entrada.id,
        amount: tipoEntrada.precio,
        status: Math.random() > 0.1 ? 'SUCCESS' : 'PENDING' // 90% exitosos
      }
    });

    entradas.push(entrada);
    payments.push(payment);
  }

  console.log(`✅ ${entradas.length} entradas vendidas creadas`);

  // 7. Actualizar estadísticas de productoras
  console.log('📊 Actualizando estadísticas...');
  
  for (const productora of productoras) {
    const eventosCount = await prisma.eventos.count({
      where: { productoraId: productora.id }
    });

    const ventasExitosas = await prisma.entrada.count({
      where: {
        tipoEntrada: {
          evento: {
            productoraId: productora.id
          }
        },
        payment: {
          status: 'SUCCESS'
        }
      }
    });

    const totalRevenue = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        entrada: {
          tipoEntrada: {
            evento: {
              productoraId: productora.id
            }
          }
        }
      },
      _sum: {
        amount: true
      }
    });

    const organizadores = await prisma.profile.count({
      where: {
        productoraId: productora.id,
        roles: {
          some: {
            role: {
              in: ['LIDER', 'PUBLICA', 'SUBPUBLICA']
            }
          }
        }
      }
    });

    await prisma.productora.update({
      where: { id: productora.id },
      data: {
        totalEvents: eventosCount,
        activeEvents: eventosCount, 
        totalOrganizers: organizadores,
        totalRevenue: totalRevenue._sum.amount || 0
      }
    });
  }

  console.log('✅ Estadísticas actualizadas');

  console.log('\n🎉 ¡Seeder completado exitosamente!');
  console.log('\n📋 Resumen de datos creados:');
  console.log(`👤 Usuarios: ${users.length}`);
  console.log(`🏢 Productoras: ${productoras.length}`);
  console.log(`🎪 Eventos: ${eventos.length}`);
  console.log(`🎫 Tipos de entrada: ${tiposEntrada.length}`);
  console.log(`💳 Entradas vendidas: ${entradas.length}`);
  console.log('\n🔑 Credenciales de acceso:');
  console.log('📧 Email: admin@ticketera.com | 🔒 Password: 123456 (SUPERADMIN)');
  console.log('📧 Email: carlos@musicpro.com | 🔒 Password: 123456 (OWNER Music Pro)');
  console.log('📧 Email: maria@eventoslive.com | 🔒 Password: 123456 (OWNER Eventos Live)');
  console.log('📧 Email: ana@musicpro.com | 🔒 Password: 123456 (LIDER + QR)');
  console.log('📧 Email: sofia@musicpro.com | 🔒 Password: 123456 (PUBLICA + QR)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error ejecutando seeder:', e);
    await prisma.$disconnect();
    process.exit(1);
  });