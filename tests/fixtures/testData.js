// Datos de prueba para usuarios
export const userFixtures = {
  validUser: {
    email: 'valid@example.com',
    name: 'Valid User',
    lastName: 'Test',
    phone: '1234567890',
    dni: '12345678',
    password: 'password123'
  },
  
  adminUser: {
    email: 'admin@example.com',
    name: 'Admin User',
    lastName: 'Administrator',
    phone: '0987654321',
    dni: '87654321',
    role: 'ADMIN',
    password: 'adminpass123'
  },

  incompleteUser: {
    email: 'incomplete@example.com'
    // Faltan campos requeridos intencionalmente
  },

  invalidEmail: {
    email: 'invalid-email',
    name: 'Invalid Email',
    password: 'password123'
  }
}

// Datos de prueba para eventos
export const eventoFixtures = {
  validEvento: {
    nombre: 'Concierto de Rock',
    descripcion: 'Un increíble concierto de rock',
    fecha: new Date('2024-12-31T20:00:00Z'),
    ubicacion: 'Estadio Nacional',
    capacidad: 50000,
    imagen: 'https://example.com/image.jpg',
    estado: 'ACTIVO'
  },

  pastEvento: {
    nombre: 'Evento Pasado',
    descripcion: 'Un evento que ya ocurrió',
    fecha: new Date('2020-01-01T20:00:00Z'),
    ubicacion: 'Lugar Test',
    capacidad: 100,
    estado: 'FINALIZADO'
  },

  draftEvento: {
    nombre: 'Evento Borrador',
    descripcion: 'Un evento en borrador',
    fecha: new Date('2025-06-15T19:00:00Z'),
    ubicacion: 'Teatro Municipal',
    capacidad: 500,
    estado: 'BORRADOR'
  }
}

// Datos de prueba para productoras
export const productoraFixtures = {
  validProductora: {
    nombre: 'Productora Test',
    descripcion: 'Una productora de eventos de prueba',
    email: 'productora@example.com',
    telefono: '1234567890',
    sitioWeb: 'https://productora-test.com',
    direccion: 'Calle Test 123'
  },

  minimalProductora: {
    nombre: 'Productora Mínima',
    email: 'minimal@example.com'
  }
}

// Datos de prueba para tipos de entrada
export const tipoEntradaFixtures = {
  generalEntry: {
    nombre: 'General',
    descripcion: 'Entrada general',
    precio: 5000,
    cantidad: 1000,
    disponible: true
  },

  vipEntry: {
    nombre: 'VIP',
    descripcion: 'Entrada VIP con beneficios especiales',
    precio: 15000,
    cantidad: 100,
    disponible: true
  },

  soldOutEntry: {
    nombre: 'Agotada',
    descripcion: 'Entrada agotada',
    precio: 8000,
    cantidad: 0,
    disponible: false
  }
}

// Datos de prueba para entradas
export const entradaFixtures = {
  validEntrada: {
    codigo: 'TEST-001',
    estado: 'VENDIDA',
    fechaCompra: new Date(),
    precio: 5000
  },

  pendingEntrada: {
    codigo: 'TEST-002',
    estado: 'PENDIENTE',
    precio: 8000
  },

  usedEntrada: {
    codigo: 'TEST-003',
    estado: 'USADA',
    fechaCompra: new Date('2024-01-01'),
    fechaUso: new Date('2024-01-15'),
    precio: 12000
  }
}

// Datos de prueba para autenticación
export const authFixtures = {
  validLogin: {
    email: 'test@example.com',
    password: 'password123'
  },

  invalidLogin: {
    email: 'test@example.com',
    password: 'wrongpassword'
  },

  magicLinkLogin: {
    email: 'magiclink@example.com'
  },

  expiredToken: 'expired.jwt.token',
  validRefreshToken: 'valid.refresh.token'
}

// Datos de prueba para pagos
export const paymentFixtures = {
  validPayment: {
    amount: 5000,
    currency: 'ARS',
    paymentMethod: 'credit_card',
    description: 'Compra de entrada para evento'
  },

  invalidPayment: {
    amount: -100, // Monto inválido
    currency: 'USD'
  }
}

// Headers comunes para requests
export const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

// Respuestas esperadas comunes
export const expectedResponses = {
  unauthorized: {
    status: 401,
    body: { error: expect.any(String) }
  },

  forbidden: {
    status: 403,
    body: { error: expect.any(String) }
  },

  notFound: {
    status: 404,
    body: { error: expect.any(String) }
  },

  badRequest: {
    status: 400,
    body: { error: expect.any(String) }
  },

  success: {
    status: 200
  },

  created: {
    status: 201
  }
}
