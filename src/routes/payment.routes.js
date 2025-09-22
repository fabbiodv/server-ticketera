import { Router } from 'express';
import { generatePaymentLink, getVentasByVendedor } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/generar-link', authMiddleware, generatePaymentLink);
router.get('/ventas/vendedor/:vendedorId', authMiddleware, getVentasByVendedor);

export default router;