import { Router } from 'express';
import { generatePaymentLink, getVentasByVendedor } from '../controllers/payment.controller.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { generatePaymentLinkByVendedorQR } from '../controllers/vendedores.controller.js';
const router = Router();

router.post('/generar-link', authMiddleware, generatePaymentLink);
router.post('/generar-link-vendedor', authMiddleware, generatePaymentLinkByVendedorQR);
router.get('/ventas/vendedor/:vendedorId', authMiddleware, getVentasByVendedor);

export default router;