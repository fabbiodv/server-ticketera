import { Router } from 'express';
import { aceptarInvitacion, getInvitationDetails } from '../controllers/invitation.controller.js';

const router = Router();

// Rutas públicas para invitaciones
router.get('/:token', getInvitationDetails);  // Ver detalles de la invitación
router.post('/:token/accept', aceptarInvitacion);  // Aceptar invitación

export default router;