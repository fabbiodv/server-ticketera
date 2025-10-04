import { Router } from 'express'
import {
  login,
  verify,
  logout,
  getSession,
  refresh,
  connectMercadoPago,
  mercadoPagoCallback,
  register,
  loginWithPassword,
  updatePassword
} from '../controllers/auth.controller.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = Router()

router.post('/login', login)
router.get('/verify', verify)
router.post('/logout', logout)
router.get('/session', authenticateToken, getSession)
router.get('/me', authenticateToken, getSession)  // Alias para /session
router.post('/refresh', refresh)
router.post('/connect-mercadopago', authenticateToken, connectMercadoPago)
router.get('/mp-callback', mercadoPagoCallback)

router.post('/register', register)
router.post('/login-password', loginWithPassword)
router.post('/update-password', authenticateToken, updatePassword)

export default router