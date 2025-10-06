import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { getEventoById } from '../../src/controllers/evento.controller.js'

// Mock del PrismaClient
vi.mock('@prisma/client/extension')
vi.mock('../../src/config/database.js')

// Mock de PrismaClient constructor
const mockPrismaInstance = {
  eventos: {
    findUnique: vi.fn()
  }
}

// Mock del constructor PrismaClient
const MockPrismaClient = vi.fn().mockImplementation(() => mockPrismaInstance)

vi.doMock('@prisma/client/extension', () => ({
  PrismaClient: MockPrismaClient
}))

describe('getEventoById Controller - Integration Tests', () => {
  let app

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Crear app de Express para cada test
    app = express()
    app.use(express.json())
    app.get('/eventos/:id', getEventoById)
  })

  describe('Successful Operations', () => {
    it('should return evento when found', async () => {
      const mockEvento = {
        id: 1,
        name: 'Test Event',
        description: 'Test Description',
        date: '2024-12-31T20:00:00Z',
        location: 'Test Venue',
        capacity: 100,
        status: 'active',
        productoraId: 1,
        productora: {
          id: 1,
          name: 'Test Productora',
          code: 'TEST001'
        }
      }

      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockEvento)
      
      // Verificar que se llama con los parámetros correctos
      expect(MockPrismaClient).toHaveBeenCalledTimes(1)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          productora: true
        }
      })
    })

    it('should handle numeric string IDs correctly', async () => {
      const mockEvento = {
        id: 123,
        name: 'Another Event',
        productora: { name: 'Productora Test' }
      }

      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/123')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe(123)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        include: {
          productora: true
        }
      })
    })

    it('should include productora data when found', async () => {
      const mockEvento = {
        id: 1,
        name: 'Event with Productora',
        productora: {
          id: 5,
          name: 'Amazing Productions',
          code: 'AMAZ001',
          email: 'contact@amazing.com'
        }
      }

      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body.productora).toEqual(mockEvento.productora)
      expect(response.body.productora.name).toBe('Amazing Productions')
    })
  })

  describe('Error Handling', () => {
    it('should return 404 when evento not found', async () => {
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/999')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ message: 'Evento no encontrado' })
      
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          productora: true
        }
      })
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockPrismaInstance.eventos.findUnique.mockRejectedValue(dbError)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Error al obtener evento' })
      
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should handle Prisma validation errors', async () => {
      const validationError = new Error('Invalid ID format')
      validationError.code = 'P2025'
      mockPrismaInstance.eventos.findUnique.mockRejectedValue(validationError)

      const response = await request(app)
        .get('/eventos/invalid')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Error al obtener evento' })
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout')
      timeoutError.code = 'P1008'
      mockPrismaInstance.eventos.findUnique.mockRejectedValue(timeoutError)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Error al obtener evento')
    })
  })

  describe('Input Validation', () => {
    it('should handle zero as valid ID', async () => {
      const mockEvento = { id: 0, name: 'Event Zero' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/0')

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 0 },
        include: { productora: true }
      })
    })

    it('should handle negative IDs', async () => {
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/-1')

      expect(response.status).toBe(404)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: -1 },
        include: { productora: true }
      })
    })

    it('should handle very large IDs', async () => {
      const largeId = '999999999'
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get(`/eventos/${largeId}`)

      expect(response.status).toBe(404)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 999999999 },
        include: { productora: true }
      })
    })

    it('should convert string IDs to numbers properly', async () => {
      const mockEvento = { id: 42, name: 'Event 42' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/42')

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 42 }, // Debe ser número, no string
        include: { productora: true }
      })
    })
  })

  describe('Response Format Validation', () => {
    it('should return proper JSON content type', async () => {
      const mockEvento = { id: 1, name: 'Test' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('should preserve all evento properties in response', async () => {
      const mockEvento = {
        id: 1,
        name: 'Complete Event',
        description: 'Full description',
        date: '2024-12-31T20:00:00Z',
        location: 'Full Location',
        capacity: 500,
        status: 'published',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
        productoraId: 1,
        productora: {
          id: 1,
          name: 'Full Productora',
          code: 'FULL001'
        }
      }

      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockEvento)
      
      // Verificar propiedades específicas
      expect(response.body.id).toBe(1)
      expect(response.body.name).toBe('Complete Event')
      expect(response.body.capacity).toBe(500)
      expect(response.body.productora.name).toBe('Full Productora')
    })

    it('should handle evento without productora', async () => {
      const mockEvento = {
        id: 1,
        name: 'Event Without Productora',
        productora: null
      }

      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body.productora).toBeNull()
    })
  })

  describe('PrismaClient Instantiation', () => {
    it('should create new PrismaClient instance for each request', async () => {
      const mockEvento = { id: 1, name: 'Test' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      // Primera petición
      await request(app).get('/eventos/1')
      expect(MockPrismaClient).toHaveBeenCalledTimes(1)

      // Segunda petición
      await request(app).get('/eventos/2')
      expect(MockPrismaClient).toHaveBeenCalledTimes(2)
    })

    it('should call findUnique with correct parameters', async () => {
      const mockEvento = { id: 123, name: 'Test Event' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      await request(app).get('/eventos/123')

      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        include: {
          productora: true
        }
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle floating point IDs by converting to integer', async () => {
      const mockEvento = { id: 123, name: 'Float ID Event' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/123.45')

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 123 }, // 123.45 se convierte a 123
        include: { productora: true }
      })
    })

    it('should handle leading zeros in ID', async () => {
      const mockEvento = { id: 123, name: 'Leading Zero Event' }
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/00123')

      expect(response.status).toBe(200)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: 123 }, // "00123" se convierte a 123
        include: { productora: true }
      })
    })

    it('should handle non-numeric IDs as NaN', async () => {
      mockPrismaInstance.eventos.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/abc')

      expect(response.status).toBe(404)
      expect(mockPrismaInstance.eventos.findUnique).toHaveBeenCalledWith({
        where: { id: NaN },
        include: { productora: true }
      })
    })
  })
})
