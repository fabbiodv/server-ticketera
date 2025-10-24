import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getMisVendedores, 
  getAllVendedores, 
  getVendedoresProductora,
  generarQRVendedor,
  getEventosDisponiblesByQR 
} from '../../src/controllers/vendedores.controller.js';
import prisma from '../../src/config/database.js';

// Mock Prisma
vi.mock('../../src/config/database.js', () => ({
  default: {
    profile: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    eventos: {
      findMany: vi.fn()
    }
  }
}));

// Mock services
vi.mock('../../src/services/generateVendedorQr.services.js', () => ({
  asignarQRToProfile: vi.fn(),
  getVendedorByQR: vi.fn()
}));

describe('🧑‍💼 Vendedores Controller - TDD Tests', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Setup fresh mock objects for each test
    mockReq = {
      user: { userId: 1 },
      params: {},
      query: {},
      body: {}
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn(() => mockRes)
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('📋 getMisVendedores', () => {
    describe('🔒 Validaciones de permisos', () => {
      it('debe retornar 403 si el usuario no es OWNER ni LIDER de ninguna productora', async () => {
        // Arrange
        prisma.profile.findMany.mockResolvedValueOnce([]); // No tiene perfiles OWNER/LIDER

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'No tienes permisos para ver vendedores. Debes ser OWNER o LIDER de al menos una productora.'
        });
      });

      it('debe buscar perfiles donde el usuario es OWNER o LIDER', async () => {
        // Arrange
        const mockProductoras = [{ productoraId: 1 }, { productoraId: 2 }];
        prisma.profile.findMany
          .mockResolvedValueOnce(mockProductoras) // Primera llamada: productoras del usuario
          .mockResolvedValueOnce([]); // Segunda llamada: vendedores
        prisma.profile.count.mockResolvedValueOnce(0);

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalledWith({
          where: {
            userId: 1,
            roles: {
              some: { 
                role: { in: ['OWNER', 'LIDER'] }
              }
            }
          },
          select: { productoraId: true }
        });
      });
    });

    describe('🎯 Filtros y consultas', () => {
      beforeEach(() => {
        // Setup básico: usuario tiene permisos
        const mockProductoras = [{ productoraId: 1 }, { productoraId: 2 }];
        prisma.profile.findMany
          .mockResolvedValueOnce(mockProductoras)
          .mockResolvedValueOnce([]);
        prisma.profile.count.mockResolvedValueOnce(0);
      });

      it('debe filtrar vendedores solo de las productoras del usuario', async () => {
        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenNthCalledWith(2, {
          where: expect.objectContaining({
            productoraId: { in: [1, 2] },
            roles: {
              some: {
                role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
              }
            }
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });

      it('debe aplicar filtro por QR cuando hasQR=true', async () => {
        // Arrange
        mockReq.query.hasQR = 'true';

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenNthCalledWith(2, {
          where: expect.objectContaining({
            qrCode: { not: null }
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });

      it('debe aplicar filtro por nombre de usuario', async () => {
        // Arrange
        mockReq.query.name = 'Juan';

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenNthCalledWith(2, {
          where: expect.objectContaining({
            user: { name: { contains: 'Juan', mode: 'insensitive' } }
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });

      it('debe aplicar paginación correctamente', async () => {
        // Arrange
        mockReq.query.page = '2';
        mockReq.query.limit = '10';

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenNthCalledWith(2, {
          where: expect.any(Object),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
          skip: 10,
          take: 10
        });
      });
    });

    describe('📊 Respuesta exitosa', () => {
      it('debe retornar vendedores con información completa y paginación', async () => {
        // Arrange
        const mockProductoras = [{ productoraId: 1 }];
        const mockVendedores = [
          {
            id: 1,
            userId: 2,
            productoraId: 1,
            qrCode: 'QR123',
            user: { id: 2, name: 'Juan', email: 'juan@test.com', status: 'ACTIVE' },
            roles: [{ role: 'PUBLICA' }],
            productora: { id: 1, name: 'Mi Productora', code: 'MP001' }
          }
        ];

        prisma.profile.findMany
          .mockResolvedValueOnce(mockProductoras)
          .mockResolvedValueOnce(mockVendedores);
        prisma.profile.count.mockResolvedValueOnce(1);

        mockReq.query.page = '1';
        mockReq.query.limit = '10';

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(mockRes.json).toHaveBeenCalledWith({
          vendedores: mockVendedores,
          misProductoras: [1],
          pagination: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1
          }
        });
      });
    });

    describe('🚨 Manejo de errores', () => {
      it('debe manejar errores de base de datos', async () => {
        // Arrange
        prisma.profile.findMany.mockRejectedValueOnce(new Error('DB Error'));

        // Act
        await getMisVendedores(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Error al obtener mis vendedores: DB Error'
        });
      });
    });
  });

  describe('📋 getAllVendedores', () => {
    describe('🎯 Consulta básica', () => {
      it('debe obtener todos los vendedores sin filtros', async () => {
        // Arrange
        prisma.profile.findMany.mockResolvedValueOnce([]);
        prisma.profile.count.mockResolvedValueOnce(0);

        // Act
        await getAllVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalledWith({
          where: {
            roles: {
              some: {
                role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
              }
            }
          },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });

      it('debe aplicar filtro por productora específica', async () => {
        // Arrange
        mockReq.query.productoraId = '5';
        prisma.profile.findMany.mockResolvedValueOnce([]);
        prisma.profile.count.mockResolvedValueOnce(0);

        // Act
        await getAllVendedores(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            productoraId: 5
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });
    });

    describe('📊 Estructura de respuesta', () => {
      it('debe incluir información de paginación completa', async () => {
        // Arrange
        const mockVendedores = [{ id: 1 }];
        prisma.profile.findMany.mockResolvedValueOnce(mockVendedores);
        prisma.profile.count.mockResolvedValueOnce(25);
        mockReq.query.limit = '10';
        mockReq.query.page = '2';

        // Act
        await getAllVendedores(mockReq, mockRes);

        // Assert
        expect(mockRes.json).toHaveBeenCalledWith({
          vendedores: mockVendedores,
          pagination: {
            total: 25,
            page: 2,
            limit: 10,
            totalPages: 3
          }
        });
      });
    });
  });

  describe('📋 getVendedoresProductora', () => {
    beforeEach(() => {
      mockReq.params.productoraId = '1';
    });

    describe('🎯 Validaciones de parámetros', () => {
      it('debe convertir productoraId a entero', async () => {
        // Arrange
        prisma.profile.findMany.mockResolvedValueOnce([]);

        // Act
        await getVendedoresProductora(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            productoraId: 1
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });

      it('debe filtrar solo roles de vendedor para la productora específica', async () => {
        // Arrange
        prisma.profile.findMany.mockResolvedValueOnce([]);

        // Act
        await getVendedoresProductora(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            productoraId: 1,
            roles: {
              some: {
                role: { in: ['PUBLICA', 'SUBPUBLICA', 'LIDER'] }
              }
            }
          }),
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' }
        });
      });
    });

    describe('🔍 Filtros específicos', () => {
      it('debe aplicar múltiples filtros simultáneamente', async () => {
        // Arrange
        mockReq.query = {
          hasQR: 'false',
          role: 'PUBLICA',
          email: 'ana@'
        };
        prisma.profile.findMany.mockResolvedValueOnce([]);

        // Act
        await getVendedoresProductora(mockReq, mockRes);

        // Assert
        expect(prisma.profile.findMany).toHaveBeenCalled();
        const call = prisma.profile.findMany.mock.calls[0][0];
        
        // Validar estructura básica que sabemos que se aplica
        expect(call.where.productoraId).toBe(1);
        expect(call.where.qrCode).toBe(null);
        expect(call.where.roles.some.role).toBe('PUBLICA');
        expect(call.orderBy.createdAt).toBe('desc');
        
        // Validar que el filtro de email se aplicó
        expect(JSON.stringify(call)).toContain('ana@');
      });
    });
  });

  describe('🔄 generarQRVendedor', () => {
    beforeEach(() => {
      mockReq.params.profileId = '5';
    });

    describe('✅ Generación exitosa', () => {
      it('debe generar QR y retornar información completa', async () => {
        // Arrange
        const { asignarQRToProfile } = await import('../../src/services/generateVendedorQr.services.js');
        asignarQRToProfile.mockResolvedValueOnce('QR-VENDEDOR-123');
        process.env.FRONTEND_URL = 'https://test.com';

        // Act
        await generarQRVendedor(mockReq, mockRes);

        // Assert
        expect(asignarQRToProfile).toHaveBeenCalledWith(5);
        expect(mockRes.json).toHaveBeenCalledWith({
          profileId: 5,
          qrCode: 'QR-VENDEDOR-123',
          url: 'https://test.com/vendedor/QR-VENDEDOR-123',
          message: 'QR de vendedor generado exitosamente'
        });
      });
    });

    describe('🚨 Manejo de errores', () => {
      it('debe manejar errores del servicio de QR', async () => {
        // Arrange
        const { asignarQRToProfile } = await import('../../src/services/generateVendedorQr.services.js');
        asignarQRToProfile.mockRejectedValueOnce(new Error('Profile no encontrado'));

        // Act
        await generarQRVendedor(mockReq, mockRes);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Profile no encontrado'
        });
      });
    });
  });

  describe('🎪 getEventosDisponiblesByQR', () => {
    beforeEach(() => {
      mockReq.params.qrCode = 'QR-VENDEDOR-123';
    });

    describe('🔍 Consulta de eventos', () => {
      it('debe obtener eventos de la productora del vendedor', async () => {
        // Arrange
        const mockVendedorProfile = {
          productoraId: 2,
          user: { name: 'Vendedor Test' },
          productora: { name: 'Mi Productora' }
        };
        
        const { getVendedorByQR } = await import('../../src/services/generateVendedorQr.services.js');
        getVendedorByQR.mockResolvedValueOnce(mockVendedorProfile);
        
        prisma.eventos.findMany.mockResolvedValueOnce([
          {
            id: 1,
            name: 'Evento Test',
            tipoEntrada: [{ id: 1, nombre: 'General' }],
            productora: { name: 'Mi Productora', code: 'MP001' }
          }
        ]);

        // Act
        await getEventosDisponiblesByQR(mockReq, mockRes);

        // Assert
        expect(getVendedorByQR).toHaveBeenCalledWith('QR-VENDEDOR-123');
        expect(prisma.eventos.findMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            productoraId: 2,
            date: { gte: expect.any(Date) }
          }),
          include: expect.any(Object),
          orderBy: { date: 'asc' }
        });
      });

      it('debe aplicar filtros de consulta correctamente', async () => {
        // Arrange
        mockReq.query = {
          name: 'Rock',
          location: 'Estadio',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31'
        };

        const mockVendedorProfile = {
          productoraId: 2,
          user: { name: 'Vendedor Test' },
          productora: { name: 'Mi Productora' }
        };

        const { getVendedorByQR } = await import('../../src/services/generateVendedorQr.services.js');
        getVendedorByQR.mockResolvedValueOnce(mockVendedorProfile);
        prisma.eventos.findMany.mockResolvedValueOnce([]);

        // Act
        await getEventosDisponiblesByQR(mockReq, mockRes);

        // Assert
        const call = prisma.eventos.findMany.mock.calls[0][0];
        expect(call.where.productoraId).toBe(2);
        expect(call.where.name.contains).toBe('Rock');
        expect(call.where.location.contains).toBe('Estadio');
        expect(call.where.date.gte).toBeInstanceOf(Date);
        expect(call.where.date.lte).toBeInstanceOf(Date);
        expect(call.orderBy.date).toBe('asc');
      });

      it('debe filtrar solo eventos con entradas disponibles', async () => {
        // Arrange
        const mockVendedorProfile = {
          productoraId: 2,
          user: { name: 'Vendedor Test' },
          productora: { name: 'Mi Productora' }
        };

        const { getVendedorByQR } = await import('../../src/services/generateVendedorQr.services.js');
        getVendedorByQR.mockResolvedValueOnce(mockVendedorProfile);
        
        // Eventos: uno con entradas, otro sin entradas
        prisma.eventos.findMany.mockResolvedValueOnce([
          {
            id: 1,
            name: 'Evento con entradas',
            tipoEntrada: [{ id: 1, nombre: 'General' }]
          },
          {
            id: 2,
            name: 'Evento sin entradas',
            tipoEntrada: []
          }
        ]);

        // Act
        await getEventosDisponiblesByQR(mockReq, mockRes);

        // Assert
        expect(mockRes.json).toHaveBeenCalledWith({
          vendedor: {
            name: 'Vendedor Test',
            productora: 'Mi Productora'
          },
          eventos: [
            {
              id: 1,
              name: 'Evento con entradas',
              tipoEntrada: [{ id: 1, nombre: 'General' }]
            }
          ]
        });
      });
    });
  });
});