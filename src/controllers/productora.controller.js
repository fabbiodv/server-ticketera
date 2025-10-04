import { response } from "express";
import prisma from "../config/database.js";
import getProximoCodigo from "../utils/getProximoCode.js";
import ProductoraResource from '../utils/ProductoraResource.js';

export const getAllProductoras = async (req, res) => {
  try {
    const { 
      page, limit, sortBy = 'createdAt', sortOrder = 'desc',
      name, email, code, status,
      ...otherFilters 
    } = req.query;
    
    const productoras = await prisma.productora.findMany({
      where: {
        // Filtros opcionales - solo se incluyen si existen
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(email && { email: { contains: email, mode: 'insensitive' } }),
        ...(code && { code: { contains: code, mode: 'insensitive' } }),
        ...(status && { status }),
        
        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: { 
        profiles: { 
          include: { user: true, roles: true } 
        } 
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });
    
    const data = productoras.map(ProductoraResource);
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: "Error al obtener productoras: " + error.message 
    });
  }
};

export const getProductoraByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { includeProfiles, includeEvents } = req.query;
    
    const productora = await prisma.productora.findUnique({
      where: { code },
      include: {
        ...(includeProfiles === 'true' && {
          profiles: {
            include: { user: true, roles: true }
          }
        }),
        ...(includeEvents === 'true' && {
          eventos: {
            include: { tipoEntrada: true }
          }
        })
      }
    });
    
    if (!productora) {
      return res.status(404).json({ error: "Productora no encontrada" });
    }
    
    res.json(ProductoraResource(productora));
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productora: " + error.message });
  }
};


export const createProductora = async (req, res) => {
  try {
    const nuevoCodigo = await getProximoCodigo("productora");
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Todos los campos son obligatorios: name, email" });
    }

    const [productora, profile, roleAsignado] = await prisma.$transaction(async (tx) => {
      const newProductora = await tx.productora.create({
        data: {
          name,
          code: nuevoCodigo,
          email,
        }
      });

      const newProfile = await tx.profile.create({
        data: {
          userId: 1,
          productoraId: newProductora.id
        }
      });

      const newRoleAsignado = await tx.roleAsignee.create({
        data: {
          profileId: newProfile.id,
          role: "OWNER"
        }
      });
      const productoraCompleta = await tx.productora.findUnique({
        where: { id: newProductora.id },
        include: {
          profiles: {
            include: {
              user: true,
              roles: true
            }
          }
        }
      });
      if (!productoraCompleta) {
        throw new Error("Error al obtener la productora creada");
      }
      return [productoraCompleta, newProfile, newRoleAsignado];
    });

    const productoraData = ProductoraResource(productora)
    res.status(201).json(productoraData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear la productora", details: error.message });
  }
};


export const updateProductora = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const productora = await prisma.productora.update({
      where: { id: parseInt(id) },
      data: { name, status }
    });

    res.json(productora);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar la productora" });
  }
};

export const deleteProductora = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.profile.deleteMany({ where: { productoraId: parseInt(id) } });

    await prisma.productora.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: "Productora eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar la productora" });
  }
};
