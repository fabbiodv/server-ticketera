import { Router } from 'express';
import { 
  getEventosDisponiblesByQR, 
  generarQRVendedor,
  getVendedoresProductora,
  getAllVendedores,
  getMisVendedores,
  getVendedorCompleto,
  getVendedorCompletoModular,
  asignarLider,
  asignarPublica,
  asignarSubpublica,
  getUsuariosDisponibles,
  removerRol,
  getMiembrosProductora,
  enviarInvitacion,
  getInvitacionesEnviadas,
  cancelarInvitacion
} from '../controllers/vendedores.controller.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Ruta pública para obtener eventos por QR del vendedor
router.get('/qr/:qrCode/eventos', getEventosDisponiblesByQR);

// Rutas protegidas
router.get('/usuarios-disponibles', authMiddleware, getUsuariosDisponibles);  // Usuarios disponibles para asignar
router.get('/miembros-productora', authMiddleware, getMiembrosProductora);  // Miembros actuales de la productora
router.get('/invitaciones', authMiddleware, getInvitacionesEnviadas);  // Ver invitaciones enviadas
router.post('/invitar', authMiddleware, enviarInvitacion);  // Enviar invitación por email
router.delete('/invitaciones/:invitationId/cancelar', authMiddleware, cancelarInvitacion);  // Cancelar invitación
router.post('/asignar-lider', authMiddleware, asignarLider);  // Asignar rol LIDER (solo OWNER)
router.post('/asignar-publica', authMiddleware, asignarPublica);  // Asignar rol PUBLICA
router.post('/asignar-subpublica', authMiddleware, asignarSubpublica);  // Asignar rol SUBPUBLICA
router.delete('/remover-rol', authMiddleware, removerRol);  // Remover rol PUBLICA o SUBPUBLICA
router.get('/mis-vendedores', authMiddleware, getMisVendedores);  // Nueva ruta para mis vendedores (OWNER/LIDER)
router.get('/detalle/:vendedorId', authMiddleware, getVendedorCompletoModular);  // Detalle completo de un vendedor (modularizado)
router.get('/:vendedorId', authMiddleware, getVendedorCompleto);  // Detalle completo de un vendedor (original)
router.get('/productora/:productoraId', authMiddleware, getVendedoresProductora);
router.get('/', authMiddleware, getAllVendedores);  // Todos los vendedores
router.post('/profile/:profileId/generar-qr', authMiddleware, generarQRVendedor);

export default router;