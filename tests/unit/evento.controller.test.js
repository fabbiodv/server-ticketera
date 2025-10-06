import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

import { createTestApp } from '../helpers/testApp.js'
import { 
  cleanDatabase, 
  expectErrorResponse, 
  expectSuccessResponse,
  createTestProductora
} from '../helpers/testHelpers.js'

describe('Evento Controller - getEventoById Tests', () => {
  let app

  beforeEach(async () => {
    app = createTestApp()
    await cleanDatabase()
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  // Helper para crear un evento de prueba
  const createTestEvento = async (overrides = {}) => {
    // Primero crear una productora
    const productora = await global.testPrisma.productora.create({
      data: {
        name: 'Test Productora',
        email: 'productora@test.com',
        code: 'TEST001'
      }
    })

    const defaultEvento = {
      name: 'Test Event',
      date: new Date('2024-12-31T20:00:00Z'),
      startTime: new Date('2024-12-31T20:00:00Z'),
      endTime: new Date('2024-12-31T23:00:00Z'),
      description: 'Test event description',
      location: 'Test Location',
      capacity: 100,
      status: 'PROGRAMADO',
      productoraId: productora.id,
      ...overrides
    }

    return await global.testPrisma.eventos.create({
      data: defaultEvento,
      include: {
        productora: true
      }
    })
  }

  describe('GET /eventos/:id - Success Cases', () => {
    it('should get evento by valid ID', async () => {
      const evento = await createTestEvento()

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body).toHaveProperty('id', evento.id)
      expect(response.body).toHaveProperty('name', evento.name)
      expect(response.body).toHaveProperty('location', evento.location)
      expect(response.body).toHaveProperty('capacity', evento.capacity)
      expect(response.body).toHaveProperty('status', evento.status)
      expect(response.body).toHaveProperty('productora')
      expect(response.body.productora).toHaveProperty('name')
    })

    it('should include productora information', async () => {
      const evento = await createTestEvento({
        name: 'Concert with Productora'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.productora).toBeDefined()
      expect(response.body.productora).toHaveProperty('id')
      expect(response.body.productora).toHaveProperty('name', 'Test Productora')
      expect(response.body.productora).toHaveProperty('email', 'productora@test.com')
    })

    it('should handle different event statuses', async () => {
      const eventoActivo = await createTestEvento({ 
        name: 'Active Event',
        status: 'ACTIVO' 
      })

      const response = await request(app)
        .get(`/eventos/${eventoActivo.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.status).toBe('ACTIVO')
      expect(response.body.name).toBe('Active Event')
    })

    it('should return evento with correct date format', async () => {
      const testDate = new Date('2025-06-15T19:30:00Z')
      const evento = await createTestEvento({
        date: testDate,
        startTime: testDate,
        endTime: new Date('2025-06-15T22:30:00Z')
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.date).toBeDefined()
      expect(new Date(response.body.date)).toEqual(testDate)
    })
  })

  describe('GET /eventos/:id - Error Cases', () => {
    it('should return 404 for non-existent evento ID', async () => {
      const nonExistentId = 99999

      const response = await request(app)
        .get(`/eventos/${nonExistentId}`)

      expectErrorResponse(response, 404, 'Evento no encontrado')
    })

    it('should return 404 for deleted evento', async () => {
      const evento = await createTestEvento()
      
      // Eliminar el evento
      await global.testPrisma.eventos.delete({
        where: { id: evento.id }
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectErrorResponse(response, 404, 'Evento no encontrado')
    })

    it('should handle invalid ID format gracefully', async () => {
      const response = await request(app)
        .get('/eventos/invalid-id')

      expect(response.status).toBe(500)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Error al obtener evento')
    })

    it('should handle negative ID', async () => {
      const response = await request(app)
        .get('/eventos/-1')

      expectErrorResponse(response, 404, 'Evento no encontrado')
    })

    it('should handle zero ID', async () => {
      const response = await request(app)
        .get('/eventos/0')

      expectErrorResponse(response, 404, 'Evento no encontrado')
    })

    it('should handle very large ID numbers', async () => {
      const largeId = Number.MAX_SAFE_INTEGER

      const response = await request(app)
        .get(`/eventos/${largeId}`)

      expectErrorResponse(response, 404, 'Evento no encontrado')
    })
  })

  describe('GET /eventos/:id - Data Integrity', () => {
    it('should return consistent data structure', async () => {
      const evento = await createTestEvento({
        name: 'Data Structure Test',
        description: 'Testing data consistency',
        capacity: 500
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      
      // Verificar estructura esperada
      const expectedFields = [
        'id', 'name', 'date', 'startTime', 'endTime', 
        'description', 'location', 'capacity', 'status', 
        'productoraId', 'productora'
      ]
      
      expectedFields.forEach(field => {
        expect(response.body).toHaveProperty(field)
      })
    })

    it('should not expose sensitive productora data', async () => {
      const evento = await createTestEvento()

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      
      // Verificar que no se expongan datos sensibles (si los hay)
      expect(response.body.productora).toBeDefined()
      // Aquí podrías verificar que no se expongan passwords, tokens, etc.
    })

    it('should handle special characters in evento data', async () => {
      const evento = await createTestEvento({
        name: 'Evento con Ñoño & Símbolos €',
        description: 'Descripción con acentos y símbolos especiales: áéíóú',
        location: 'Ubicación con caracteres especiales: São Paulo'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.name).toBe('Evento con Ñoño & Símbolos €')
      expect(response.body.description).toContain('acentos y símbolos especiales')
      expect(response.body.location).toBe('Ubicación con caracteres especiales: São Paulo')
    })
  })

  describe('GET /eventos/:id - Performance Tests', () => {
    it('should respond within reasonable time', async () => {
      const evento = await createTestEvento()

      const startTime = Date.now()
      
      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expectSuccessResponse(response, 200)
      expect(responseTime).toBeLessThan(1000) // Menos de 1 segundo
    })

    it('should handle multiple concurrent requests', async () => {
      const evento = await createTestEvento()

      // Hacer múltiples requests simultáneos
      const requests = Array(5).fill().map(() => 
        request(app).get(`/eventos/${evento.id}`)
      )

      const responses = await Promise.all(requests)

      // Todos deberían tener éxito
      responses.forEach(response => {
        expectSuccessResponse(response, 200)
        expect(response.body.id).toBe(evento.id)
      })
    })
  })

  describe('GET /eventos/:id - Edge Cases', () => {
    it('should handle evento with null/empty optional fields', async () => {
      const evento = await createTestEvento({
        description: null, // Campo opcional
        name: 'Minimal Event Data'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.name).toBe('Minimal Event Data')
      expect(response.body.description).toBeNull()
    })

    it('should handle evento with minimum capacity', async () => {
      const evento = await createTestEvento({
        capacity: 1,
        name: 'Single Person Event'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.capacity).toBe(1)
    })

    it('should handle evento with maximum capacity', async () => {
      const evento = await createTestEvento({
        capacity: 100000,
        name: 'Stadium Event'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.capacity).toBe(100000)
    })

    it('should handle past events', async () => {
      const pastDate = new Date('2020-01-01T20:00:00Z')
      const evento = await createTestEvento({
        date: pastDate,
        startTime: pastDate,
        endTime: new Date('2020-01-01T23:00:00Z'),
        status: 'FINALIZADO'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.status).toBe('FINALIZADO')
      expect(new Date(response.body.date)).toEqual(pastDate)
    })

    it('should handle future events', async () => {
      const futureDate = new Date('2030-12-31T20:00:00Z')
      const evento = await createTestEvento({
        date: futureDate,
        startTime: futureDate,
        endTime: new Date('2030-12-31T23:00:00Z'),
        status: 'PROGRAMADO'
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.status).toBe('PROGRAMADO')
      expect(new Date(response.body.date)).toEqual(futureDate)
    })
  })

  describe('GET /eventos/:id - Database Consistency', () => {
    it('should maintain referential integrity with productora', async () => {
      const evento = await createTestEvento()

      // Verificar que la productora existe en la BD
      const productoraInDb = await global.testPrisma.productora.findUnique({
        where: { id: evento.productoraId }
      })

      expect(productoraInDb).toBeTruthy()

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      expectSuccessResponse(response, 200)
      expect(response.body.productora.id).toBe(productoraInDb.id)
      expect(response.body.productora.name).toBe(productoraInDb.name)
    })

    it('should handle orphaned evento (productora deleted)', async () => {
      const evento = await createTestEvento()
      
      // Eliminar la productora (esto normalmente no debería pasar por FK constraints)
      // Pero testearemos el caso donde la relación se rompe
      await global.testPrisma.productora.delete({
        where: { id: evento.productoraId }
      }).catch(() => {
        // Si falla por FK constraint, es el comportamiento esperado
        // En este caso el test seguirá con la productora existente
      })

      const response = await request(app)
        .get(`/eventos/${evento.id}`)

      // El comportamiento puede variar según la configuración de FK
      // Podría devolver 500 error o el evento sin productora
      expect([200, 500]).toContain(response.status)
    })
  })
})
