import crypto from 'crypto';
import prisma from '../config/database.js';

// Generar QR único para vendedor
export const generateVendedorQR = () => {
  return `VND-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
};

// Asignar QR a un perfil si no lo tiene
export const asignarQRToProfile = async (profileId) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { roles: true }
    });

    if (!profile) {
      throw new Error('Perfil no encontrado');
    }

    // Verificar que el perfil tenga rol de vendedor
    const isVendedor = profile.roles.some(role => 
      ['PUBLICA', 'SUBPUBLICA', 'LIDER'].includes(role.role)
    );

    if (!isVendedor) {
      throw new Error('El perfil no tiene rol de vendedor');
    }

    // Si ya tiene QR, devolverlo
    if (profile.qrCode) {
      return profile.qrCode;
    }

    // Generar nuevo QR
    const newQR = generateVendedorQR();
    
    await prisma.profile.update({
      where: { id: profileId },
      data: { qrCode: newQR }
    });

    return newQR;
  } catch (error) {
    console.error('Error al asignar QR:', error);
    throw error;
  }
};

// Obtener vendedor por QR
export const getVendedorByQR = async (qrCode) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { qrCode },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        productora: {
          select: { id: true, name: true, code: true }
        },
        roles: true
      }
    });

    if (!profile) {
      throw new Error('QR de vendedor no válido');
    }

    return profile;
  } catch (error) {
    console.error('Error al obtener vendedor por QR:', error);
    throw error;
  }
};