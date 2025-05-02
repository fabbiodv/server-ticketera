import { Router } from 'express';
import webhookController from '../controllers/webhook.controller.js';

const router = Router();

router.post('/mercadopago', webhookController.webhookMercadoPago);

export default router;