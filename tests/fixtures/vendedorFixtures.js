// Fixtures específicas para tests de vendedores

export const vendedorFixtures = {
  // Datos de usuarios para diferentes roles
  ownerUser: {
    name: 'Dueño Productora',
    email: 'owner@productora.com',
    password: 'password123',
    lastName: 'García',
    phone: '+541123456789',
    dni: '12345678',
    status: 'ACTIVE'
  },

  liderUser: {
    name: 'Líder Eventos',
    email: 'lider@productora.com',
    password: 'password123',
    lastName: 'López',
    phone: '+541987654321',
    dni: '87654321',
    status: 'ACTIVE'
  },

  publicaUser: {
    name: 'Vendedor Público',
    email: 'publica@productora.com',
    password: 'password123',
    lastName: 'Martínez',
    phone: '+541155555555',
    dni: '55555555',
    status: 'ACTIVE'
  },

  subpublicaUser: {
    name: 'Vendedor Subpúblico',
    email: 'subpublica@productora.com',
    password: 'password123',
    lastName: 'González',
    phone: '+541144444444',
    dni: '44444444',
    status: 'ACTIVE'
  },

  noRoleUser: {
    name: 'Usuario Sin Rol',
    email: 'sinrol@test.com',
    password: 'password123',
    lastName: 'Sin Rol',
    phone: '+541133333333',
    dni: '33333333',
    status: 'ACTIVE'
  }
};

export const productoraFixtures = {
  productora1: {
    name: 'Eventos Premium',
    email: 'info@eventospremium.com',
    code: 'EVT001',
    totalEvents: 5,
    activeEvents: 3,
    totalOrganizers: 8,
    totalRevenue: 150000,
    status: 'activa'
  },

  productora2: {
    name: 'Shows y Espectáculos',
    email: 'contacto@showsyespectaculos.com',
    code: 'SHW002',
    totalEvents: 3,
    activeEvents: 2,
    totalOrganizers: 5,
    totalRevenue: 80000,
    status: 'activa'
  },

  productoraInactiva: {
    name: 'Productora Inactiva',
    email: 'inactiva@test.com',
    code: 'INA003',
    status: 'inactiva'
  }
};

export const profileFixtures = {
  ownerProfile: {
    qrCode: 'OWNER-QR-12345',
    roles: ['OWNER']
  },

  liderProfile: {
    qrCode: 'LIDER-QR-67890',
    roles: ['LIDER']
  },

  publicaProfile: {
    qrCode: 'PUBLICA-QR-11111',
    roles: ['PUBLICA']
  },

  subpublicaProfile: {
    qrCode: null, // Sin QR inicialmente
    roles: ['SUBPUBLICA']
  },

  multiRoleProfile: {
    qrCode: 'MULTI-QR-99999',
    roles: ['PUBLICA', 'SUBPUBLICA']
  }
};

export const eventoFixtures = {
  eventoActivo: {
    name: 'Festival de Rock 2025',
    date: new Date('2025-07-15T20:00:00Z'),
    startTime: new Date('2025-07-15T20:00:00Z'),
    endTime: new Date('2025-07-16T03:00:00Z'),
    description: 'El mejor festival de rock del año',
    location: 'Hipódromo de Palermo',
    capacity: 25000,
    status: 'ACTIVO'
  },

  eventoPasado: {
    name: 'Concierto Vintage',
    date: new Date('2023-05-10T21:00:00Z'),
    startTime: new Date('2023-05-10T21:00:00Z'),
    endTime: new Date('2023-05-11T01:00:00Z'),
    description: 'Concierto de música vintage',
    location: 'Teatro Colón',
    capacity: 2500,
    status: 'FINALIZADO'
  },

  eventoSinEntradas: {
    name: 'Evento Sin Entradas',
    date: new Date('2025-08-20T19:00:00Z'),
    startTime: new Date('2025-08-20T19:00:00Z'),
    endTime: new Date('2025-08-20T23:00:00Z'),
    description: 'Evento que no tiene tipos de entrada disponibles',
    location: 'Centro Cultural',
    capacity: 500,
    status: 'ACTIVO'
  }
};

export const tipoEntradaFixtures = {
  general: {
    nombre: 'General',
    precio: 8000,
    totalEntradas: 5000,
    maximoEntradasPorPersona: 4,
    estado: 'DISPONIBLE',
    disponible: true
  },

  vip: {
    nombre: 'VIP',
    precio: 20000,
    totalEntradas: 500,
    maximoEntradasPorPersona: 2,
    estado: 'DISPONIBLE',
    disponible: true
  },

  agotada: {
    nombre: 'Early Bird',
    precio: 6000,
    totalEntradas: 1000,
    maximoEntradasPorPersona: 6,
    estado: 'AGOTADA',
    disponible: false
  },

  limitada: {
    nombre: 'Last Minute',
    precio: 12000,
    totalEntradas: 100,
    maximoEntradasPorPersona: 1,
    estado: 'LIMITADA',
    disponible: true
  }
};

// Consultas y filtros de ejemplo para tests
export const queryFilters = {
  paginationBasic: {
    page: '1',
    limit: '10'
  },

  paginationSecondPage: {
    page: '2',
    limit: '5'
  },

  sortByName: {
    sortBy: 'name',
    sortOrder: 'asc'
  },

  filterByName: {
    name: 'Rock'
  },

  filterByEmail: {
    email: 'publica'
  },

  filterWithQR: {
    hasQR: 'true'
  },

  filterWithoutQR: {
    hasQR: 'false'
  },

  filterByRole: {
    role: 'PUBLICA'
  },

  filterByProductora: {
    productoraId: '1'
  },

  dateRangeFilter: {
    dateFrom: '2025-01-01',
    dateTo: '2025-12-31'
  },

  locationFilter: {
    location: 'Estadio'
  },

  multipleFilters: {
    hasQR: 'true',
    role: 'PUBLICA',
    name: 'Vendedor',
    page: '1',
    limit: '5'
  }
};

// Respuestas esperadas para diferentes escenarios
export const expectedResponses = {
  misVendedoresSuccess: {
    structure: {
      vendedores: expect.any(Array),
      misProductoras: expect.any(Array),
      pagination: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number)
      }
    }
  },

  vendedorComplete: {
    properties: [
      'id',
      'userId',
      'productoraId',
      'qrCode',
      'user',
      'roles',
      'productora',
      'createdAt',
      'updatedAt'
    ],
    userProperties: ['id', 'name', 'email', 'status'],
    productoraProperties: ['id', 'name', 'code'],
    roleProperties: ['role', 'createdAt', 'updatedAt']
  },

  eventosDisponibles: {
    structure: {
      vendedor: {
        name: expect.any(String),
        productora: expect.any(String)
      },
      eventos: expect.any(Array)
    },
    eventoProperties: [
      'id',
      'name', 
      'date',
      'location',
      'tipoEntrada',
      'productora'
    ]
  },

  qrGenerated: {
    structure: {
      profileId: expect.any(Number),
      qrCode: expect.any(String),
      url: expect.any(String),
      message: expect.any(String)
    }
  },

  errors: {
    unauthorized: {
      status: 401,
      hasError: true
    },
    forbidden: {
      status: 403,
      message: 'No tienes permisos para ver vendedores'
    },
    notFound: {
      status: 404,
      hasError: true
    },
    badRequest: {
      status: 400,
      hasError: true
    },
    serverError: {
      status: 500,
      hasError: true
    }
  }
};

// Helpers para validar estructuras de datos
export const validateVendedorStructure = (vendedor) => {
  expect(vendedor).toHaveProperty('id');
  expect(vendedor).toHaveProperty('user');
  expect(vendedor).toHaveProperty('roles');
  expect(vendedor).toHaveProperty('productora');
  
  expect(vendedor.user).toHaveProperty('id');
  expect(vendedor.user).toHaveProperty('name');
  expect(vendedor.user).toHaveProperty('email');
  expect(vendedor.user).toHaveProperty('status');
  
  expect(vendedor.productora).toHaveProperty('name');
  expect(vendedor.productora).toHaveProperty('code');
  
  expect(Array.isArray(vendedor.roles)).toBe(true);
  if (vendedor.roles.length > 0) {
    expect(vendedor.roles[0]).toHaveProperty('role');
  }
};

export const validatePaginationStructure = (pagination) => {
  expect(pagination).toHaveProperty('total');
  expect(pagination).toHaveProperty('page');
  expect(pagination).toHaveProperty('limit');
  expect(pagination).toHaveProperty('totalPages');
  
  expect(typeof pagination.total).toBe('number');
  expect(typeof pagination.page).toBe('number');
  expect(typeof pagination.limit).toBe('number');
  expect(typeof pagination.totalPages).toBe('number');
  
  expect(pagination.total).toBeGreaterThanOrEqual(0);
  expect(pagination.page).toBeGreaterThan(0);
  expect(pagination.limit).toBeGreaterThan(0);
  expect(pagination.totalPages).toBeGreaterThanOrEqual(0);
};

export const validateEventoStructure = (evento) => {
  expect(evento).toHaveProperty('id');
  expect(evento).toHaveProperty('name');
  expect(evento).toHaveProperty('date');
  expect(evento).toHaveProperty('location');
  expect(evento).toHaveProperty('tipoEntrada');
  
  expect(Array.isArray(evento.tipoEntrada)).toBe(true);
  
  // Si tiene tipos de entrada, validar estructura
  if (evento.tipoEntrada.length > 0) {
    evento.tipoEntrada.forEach(tipo => {
      expect(tipo).toHaveProperty('nombre');
      expect(tipo).toHaveProperty('precio');
      expect(tipo).toHaveProperty('disponible');
      expect(tipo).toHaveProperty('estado');
      expect(tipo.disponible).toBe(true);
      expect(tipo.estado).toBe('DISPONIBLE');
    });
  }
};