import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockPrisma = {
  tipoEntrada: {
    findUnique: vi.fn()
  },
  entrada: {
    findMany: vi.fn(),
    updateMany: vi.fn()
  },
  payment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock('../../src/config/database.js', () => ({
  default: mockPrisma
}));

const mockPreference = {
  create: vi.fn().mockResolvedValue({
    body: {
      id: 'mock-preference-id',
      init_point: 'https://mercadopago.com/checkout/mock-url'
    }
  })
};

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
  Preference: vi.fn().mockImplementation(() => mockPreference),
  Payment: vi.fn().mockImplementation(() => ({}))
}));

describe('Checkout Funcional (Con Mocks)', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    const checkoutRoutes = await import('../../src/routes/checkout.routes.js');
    app.use('/checkout', checkoutRoutes.default);
  });

  it('debe validar datos de entrada en /checkout/iniciar', async () => {
    const response = await request(app)
      .post('/checkout/iniciar')
      .send({}); 
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('tipoEntradaId y cantidad son requeridos');
  });

  it('debe manejar tipo de entrada no encontrado', async () => {
    mockPrisma.tipoEntrada.findUnique.mockResolvedValue(null);
    
    const response = await request(app)
      .post('/checkout/iniciar')
      .send({
        tipoEntradaId: 999,
        cantidad: 1
      });
      
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Tipo de entrada no encontrado');
  });

  it('debe procesar checkout válido correctamente', async () => {
    mockPrisma.tipoEntrada.findUnique.mockResolvedValue({
      id: 1,
      nombre: 'General',
      precio: 1500,
      evento: { id: 1, name: 'Test Event' }
    });
    
    mockPrisma.entrada.findMany.mockResolvedValue([
      { id: 1 }, { id: 2 } 
    ]);
    
    mockPrisma.payment.create.mockResolvedValue({
      id: 'payment-123'
    });
    
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return await fn(mockPrisma);
    });
    
    const response = await request(app)
      .post('/checkout/iniciar')
      .send({
        tipoEntradaId: 1,
        cantidad: 2
      });
      
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentId).toBe('payment-123');
    expect(response.body.data.checkoutUrl).toContain('mercadopago');
  });

  it('debe manejar falta de entradas disponibles', async () => {
    mockPrisma.tipoEntrada.findUnique.mockResolvedValue({
      id: 1,
      nombre: 'General',
      precio: 1500
    });
    
    mockPrisma.entrada.findMany.mockResolvedValue([]); 
    
    const response = await request(app)
      .post('/checkout/iniciar')
      .send({
        tipoEntradaId: 1,
        cantidad: 2
      });
      
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Solo hay 0 entradas disponibles');
  });

  it('debe responder correctamente en /checkout/limpiar-reservas', async () => {
    mockPrisma.entrada.updateMany.mockResolvedValue({ count: 3 });
    
    const response = await request(app)
      .post('/checkout/limpiar-reservas');
      
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('3 entradas liberadas');
  });
});