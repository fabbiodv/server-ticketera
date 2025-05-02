import { Router } from 'express';
import { generatePaymentLink } from '../controllers/payment.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
const router = Router();

router.post('/generar-link', authMiddleware, generatePaymentLink);


export default router;