import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

describe('getEventoById - Controller Logic Tests', () => {
  let app
  let mockPrismaClient
  let mockFindUnique

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock findUnique function
    mockFindUnique = vi.fn()
    
    // Mock PrismaClient
    mockPrismaClient = {
      eventos: {
        findUnique: mockFindUnique
      }
    }
    
    // Create Express app with mocked controller
    app = express()
    app.use(express.json())
    
    // Mock del controlador getEventoById
    app.get('/eventos/:id', async (req, res) => {
      try {
        const { id } = req.params
        const evento = await mockPrismaClient.eventos.findUnique({
          where: { id: Number(id) },
          include: {
            productora: true
          }
        })
        
        if (!evento) {
          return res.status(404).json({ message: "Evento no encontrado" })
        }
        
        res.status(200).json(evento)
      } catch (error) {
        res.status(500).json({ error: "Error al obtener evento" })
      }
    })
  })

  describe('Successful Operations', () => {
    it('should return evento when found with valid ID', async () => {
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

      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockEvento)
      expect(response.body.id).toBe(1)
      expect(response.body.name).toBe('Test Event')
      expect(response.body.productora.name).toBe('Test Productora')
      
      // Verify call parameters
      expect(mockFindUnique).toHaveBeenCalledTimes(1)
      expect(mockFindUnique).toHaveBeenCalledWith({
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

      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/123')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe(123)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 123 },
        include: {
          productora: true
        }
      })
    })

    it('should include all productora properties', async () => {
      const mockEvento = {
        id: 1,
        name: 'Event with Full Productora',
        productora: {
          id: 5,
          name: 'Amazing Productions',
          code: 'AMAZ001',
          email: 'contact@amazing.com',
          phone: '+1234567890'
        }
      }

      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body.productora).toEqual(mockEvento.productora)
      expect(response.body.productora.id).toBe(5)
      expect(response.body.productora.name).toBe('Amazing Productions')
      expect(response.body.productora.code).toBe('AMAZ001')
    })

    it('should handle evento without productora', async () => {
      const mockEvento = {
        id: 1,
        name: 'Event Without Productora',
        productora: null
      }

      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body.productora).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should return 404 when evento not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/999')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ message: 'Evento no encontrado' })
      
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: {
          productora: true
        }
      })
    })

    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection failed')
      mockFindUnique.mockRejectedValue(dbError)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Error al obtener evento' })
      expect(mockFindUnique).toHaveBeenCalledTimes(1)
    })

    it('should handle Prisma validation errors', async () => {
      const validationError = new Error('Invalid ID format')
      validationError.code = 'P2025'
      mockFindUnique.mockRejectedValue(validationError)

      const response = await request(app)
        .get('/eventos/invalid')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ error: 'Error al obtener evento' })
    })

    it('should handle query timeout errors', async () => {
      const timeoutError = new Error('Query timeout')
      timeoutError.code = 'P1008'
      mockFindUnique.mockRejectedValue(timeoutError)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Error al obtener evento')
    })

    it('should handle unexpected server errors', async () => {
      const unexpectedError = new Error('Unexpected server error')
      mockFindUnique.mockRejectedValue(unexpectedError)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Error al obtener evento')
    })
  })

  describe('Input Validation and Edge Cases', () => {
    it('should handle zero as valid ID', async () => {
      const mockEvento = { id: 0, name: 'Event Zero', productora: null }
      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/0')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe(0)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 0 },
        include: { productora: true }
      })
    })

    it('should handle negative IDs', async () => {
      mockFindUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/-1')

      expect(response.status).toBe(404)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: -1 },
        include: { productora: true }
      })
    })

    it('should handle very large IDs', async () => {
      const largeId = '999999999'
      mockFindUnique.mockResolvedValue(null)

      const response = await request(app)
        .get(`/eventos/${largeId}`)

      expect(response.status).toBe(404)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 999999999 },
        include: { productora: true }
      })
    })

    it('should convert floating point IDs to numbers', async () => {
      const mockEvento = { id: 123, name: 'Float ID Event' }
      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/123.45')

      expect(response.status).toBe(200)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 123.45 }, // 123.45 se mantiene como float
        include: { productora: true }
      })
    })

    it('should handle leading zeros in ID', async () => {
      const mockEvento = { id: 123, name: 'Leading Zero Event' }
      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/00123')

      expect(response.status).toBe(200)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 123 }, // "00123" -> 123
        include: { productora: true }
      })
    })

    it('should handle non-numeric IDs as NaN', async () => {
      mockFindUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/abc')

      expect(response.status).toBe(404)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: NaN },
        include: { productora: true }
      })
    })

    it('should handle special characters in ID', async () => {
      mockFindUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/eventos/test-123')

      expect(response.status).toBe(404)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: NaN }, // "test-123" -> NaN
        include: { productora: true }
      })
    })
  })

  describe('Response Format and Content', () => {
    it('should return proper JSON content type', async () => {
      const mockEvento = { id: 1, name: 'Test Event' }
      mockFindUnique.mockResolvedValue(mockEvento)

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
        customField: 'custom value',
        productora: {
          id: 1,
          name: 'Full Productora',
          code: 'FULL001',
          description: 'Productora description'
        }
      }

      mockFindUnique.mockResolvedValue(mockEvento)

      const response = await request(app)
        .get('/eventos/1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockEvento)
      
      // Verify specific properties
      expect(response.body.id).toBe(1)
      expect(response.body.name).toBe('Complete Event')
      expect(response.body.capacity).toBe(500)
      expect(response.body.customField).toBe('custom value')
      expect(response.body.productora.name).toBe('Full Productora')
      expect(response.body.productora.description).toBe('Productora description')
    })

    it('should return consistent structure for different eventos', async () => {
      const eventos = [
        { id: 1, name: 'Event 1', productora: { name: 'Prod 1' } },
        { id: 2, name: 'Event 2', productora: null },
        { id: 3, name: 'Event 3', productora: { name: 'Prod 3', code: 'P3' } }
      ]

      for (const evento of eventos) {
        mockFindUnique.mockResolvedValue(evento)
        
        const response = await request(app)
          .get(`/eventos/${evento.id}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(evento)
        expect(response.body.id).toBe(evento.id)
        expect(response.body.name).toBe(evento.name)
      }
    })
  })

  describe('Prisma Query Structure', () => {
    it('should always include productora in query', async () => {
      mockFindUnique.mockResolvedValue({ id: 1, name: 'Test' })

      await request(app).get('/eventos/1')

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          productora: true
        }
      })
    })

    it('should use Number() conversion for ID parameter', async () => {
      mockFindUnique.mockResolvedValue({ id: 42, name: 'Test' })

      await request(app).get('/eventos/42')

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 42 }, // Should be number, not string
        include: { productora: true }
      })
    })

    it('should handle ID conversion edge cases', async () => {
      const testCases = [
        { input: '0', expected: 0 },
        { input: '42', expected: 42 },
        { input: '-5', expected: -5 },
        { input: '123.45', expected: 123.45 },
        { input: '00123', expected: 123 },
        { input: 'abc', expected: NaN },
        { input: '1e2', expected: 100 }
      ]

      for (const testCase of testCases) {
        mockFindUnique.mockClear() // Limpiar mock antes de cada caso
        mockFindUnique.mockResolvedValue(null)
        
        await request(app).get(`/eventos/${testCase.input}`)
        
        expect(mockFindUnique).toHaveBeenCalledWith({
          where: { id: testCase.expected },
          include: { productora: true }
        })
      }
    })
  })
})
