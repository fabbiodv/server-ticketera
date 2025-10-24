import { Router } from 'express';
import { 
  getEventosDisponiblesByQR, 
  generarQRVendedor,
  getVendedoresProductora,
  getAllVendedores,
  getMisVendedores
} from '../controllers/vendedores.controller.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Ruta pública para obtener eventos por QR del vendedor
router.get('/qr/:qrCode/eventos', getEventosDisponiblesByQR);

// Rutas protegidas
router.get('/mis-vendedores', authMiddleware, getMisVendedores);  // Nueva ruta para mis vendedores (OWNER/LIDER)
router.get('/', authMiddleware, getAllVendedores);  // Todos los vendedores
router.post('/profile/:profileId/generar-qr', authMiddleware, generarQRVendedor);
router.get('/productora/:productoraId', authMiddleware, getVendedoresProductora);

export default router;