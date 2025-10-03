import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'

describe('Health Check - Basic Test', () => {
  it('should create a simple express app', () => {
    const app = express()
    app.get('/health', (req, res) => {
      res.json({ message: 'ok' })
    })
    
    expect(app).toBeDefined()
  })

  it('should respond to health check endpoint', async () => {
    const app = express()
    app.get('/health', (req, res) => {
      res.json({ message: 'ok' })
    })
    
    const response = await request(app)
      .get('/health')
    
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'ok' })
  })

  it('should handle 404 for non-existent endpoints', async () => {
    const app = express()
    app.get('/health', (req, res) => {
      res.json({ message: 'ok' })
    })
    
    const response = await request(app)
      .get('/non-existent-endpoint')
    
    expect(response.status).toBe(404)
  })

  it('should test vitest is working correctly', () => {
    expect(1 + 1).toBe(2)
    expect('hello').toBe('hello')
    expect([1, 2, 3]).toHaveLength(3)
  })
})
