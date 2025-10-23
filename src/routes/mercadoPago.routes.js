import { Router } from 'express';
import * as webhookController from '../controllers/webHook.controller.js';
const router = Router();

router.post('/mercadopago', webhookController.webhookMercadoPago);

export default router;