import prisma from '../config/database.js';
import bcrypt from 'bcrypt';

// Aceptar invitación - puede ser usado por usuarios nuevos o existentes
export const aceptarInvitacion = async (req, res) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    // Buscar la invitación
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        productora: {
          select: { id: true, name: true, code: true }
        },
        inviter: {
          select: { name: true }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Esta invitación ya fue procesada o cancelada' 
      });
    }

    if (new Date() > invitation.expiresAt) {
      // Marcar como expirada
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(400).json({ error: 'Esta invitación ha expirado' });
    }

    // Verificar si el usuario ya existe
    let user = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (!user) {
      // Crear nuevo usuario
      if (!name || !password) {
        return res.status(400).json({
          error: 'Para usuarios nuevos se requiere nombre y contraseña',
          requiredFields: ['name', 'password']
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          name: name,
          password: hashedPassword,
          status: 'ACTIVE'
        }
      });
    }

    // Verificar si ya tiene perfil en esta productora
    let profile = await prisma.profile.findFirst({
      where: {
        userId: user.id,
        productoraId: invitation.productoraId
      }
    });

    if (!profile) {
      // Crear perfil en la productora
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          productoraId: invitation.productoraId
        }
      });
    }

    // Verificar si ya tiene el rol asignado
    const existingRole = await prisma.roleAsignee.findUnique({
      where: {
        profileId_role: {
          profileId: profile.id,
          role: invitation.role
        }
      }
    });

    if (!existingRole) {
      // Asignar el rol
      await prisma.roleAsignee.create({
        data: {
          profileId: profile.id,
          role: invitation.role
        }
      });
    }

    // Marcar invitación como aceptada
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { 
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    });

    // Obtener el perfil completo
    const fullProfile = await prisma.profile.findUnique({
      where: { id: profile.id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true,
        productora: {
          select: { name: true, code: true }
        }
      }
    });

    res.json({
      message: 'Invitación aceptada exitosamente',
      user: {
        isNewUser: !user.password || user.createdAt.getTime() === user.updatedAt.getTime(),
        profile: fullProfile,
        invitation: {
          role: invitation.role,
          productora: invitation.productora.name,
          invitedBy: invitation.inviter.name
        }
      }
    });

  } catch (error) {
    console.error('Error al aceptar invitación:', error);
    res.status(500).json({ 
      error: 'Error al aceptar invitación: ' + error.message 
    });
  }
};

// Obtener detalles de una invitación (para mostrar en el frontend antes de aceptar)
export const getInvitationDetails = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        productora: {
          select: { name: true, code: true }
        },
        inviter: {
          select: { name: true }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Esta invitación ya fue procesada o cancelada',
        status: invitation.status
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ 
        error: 'Esta invitación ha expirado',
        status: 'EXPIRED'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, name: true, email: true }
    });

    const roleTranslations = {
      'LIDER': 'Líder',
      'PUBLICA': 'Relaciones Públicas',
      'SUBPUBLICA': 'Sub-Relaciones Públicas',
      'ORGANIZADOR': 'Organizador'
    };

    res.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        roleDisplay: roleTranslations[invitation.role] || invitation.role,
        productora: invitation.productora.name,
        invitedBy: invitation.inviter.name,
        expiresAt: invitation.expiresAt,
        userExists: !!existingUser
      }
    });

  } catch (error) {
    console.error('Error al obtener detalles de invitación:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalles de invitación: ' + error.message 
    });
  }
};