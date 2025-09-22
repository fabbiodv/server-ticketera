import prisma from '../config/database.js';
import { asignarQRToProfile, getVendedorByQR } from '../services/vendedorQRService.js';

// Obtener eventos disponibles para un vendedor por QR
export const getEventosDisponiblesByQR = async (req, res) => {
  try {
    const { qrCode } = req.params;

    // Obtener vendedor por QR
    const vendedorProfile = await getVendedorByQR(qrCode);

    // Obtener eventos de la productora del vendedor
    const eventos = await prisma.eventos.findMany({
      where: {
        productoraId: vendedorProfile.productoraId,
        date: {
          gte: new Date() // Solo eventos futuros
        }
      },
      include: {
        tipoEntrada: {
          where: {
            disponible: true,
            estado: 'DISPONIBLE'
          }
        },
        productora: {
          select: { name: true, code: true }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Filtrar solo eventos con tipos de entrada disponibles
    const eventosConEntradas = eventos.filter(evento => 
      evento.tipoEntrada.length > 0
    );

    res.json({
      vendedor: {
        id: vendedorProfile.user.id,
        name: vendedorProfile.user.name,
        email: vendedorProfile.user.email,
        productora: vendedorProfile.productora.name,
        qrCode: vendedorProfile.qrCode
      },
      eventos: eventosConEntradas.map(evento => ({
        id: evento.id,
        name: evento.name,
        date: evento.date,
        startTime: evento.startTime,
        endTime: evento.endTime,
        description: evento.description,
        location: evento.location,
        capacity: evento.capacity,
        productora: evento.productora.name,
        tiposEntrada: evento.tipoEntrada.map(tipo => ({
          id: tipo.id,
          nombre: tipo.nombre,
          precio: tipo.precio,
          totalEntradas: tipo.totalEntradas,
          maximoEntradasPorPersona: tipo.maximoEntradasPorPersona,
          estado: tipo.estado,
          disponible: tipo.disponible
        }))
      }))
    });

  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(400).json({ 
      error: error.message || 'Error al obtener eventos del vendedor' 
    });
  }
};

// Generar o obtener QR de un perfil vendedor
export const generarQRVendedor = async (req, res) => {
  try {
    const { profileId } = req.params;

    const qrCode = await asignarQRToProfile(parseInt(profileId));

    res.json({
      profileId: parseInt(profileId),
      qrCode,
      url: `${process.env.FRONTEND_URL}/vendedor/${qrCode}`,
      message: 'QR de vendedor generado exitosamente'
    });

  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(400).json({ 
      error: error.message || 'Error al generar QR del vendedor' 
    });
  }
};

// Listar vendedores con sus QR de una productora
export const getVendedoresProductora = async (req, res) => {
  try {
    const { productoraId } = req.params;

    const vendedores = await prisma.profile.findMany({
      where: {
        productoraId: parseInt(productoraId),
        roles: {
          some: {
            role: {
              in: ['PUBLICA', 'SUBPUBLICA', 'LIDER']
            }
          }
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        roles: true
      }
    });

    const vendedoresConQR = vendedores.map(profile => ({
      profileId: profile.id,
      user: profile.user,
      roles: profile.roles.map(r => r.role),
      qrCode: profile.qrCode,
      hasQR: !!profile.qrCode,
      qrUrl: profile.qrCode ? `${process.env.FRONTEND_URL}/vendedor/${profile.qrCode}` : null
    }));

    res.json(vendedoresConQR);

  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ 
      error: 'Error al obtener vendedores de la productora' 
    });
  }
};