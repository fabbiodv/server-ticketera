import { Router } from 'express';
import { iniciarCheckout, limpiarReservasExpiradas } from '../controllers/checkout.controller.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/iniciar', iniciarCheckout);

router.post('/limpiar-reservas', authenticateToken, async (req, res) => {
  try {
    const liberadas = await limpiarReservasExpiradas();
    res.json({ 
      success: true, 
      message: `${liberadas} entradas liberadas` 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error al limpiar reservas: ' + error.message 
    });
  }
});

export default router;