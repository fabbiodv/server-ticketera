import { response } from "express";
import prisma from "../config/database.js";
import getProximoCodigo from "../utils/getProximoCode.js";
import ProductoraResource from '../utils/ProductoraResource.js';

export const getAllProductoras = async (req, res) => {
  try {
    const productoras = await prisma.productora.findMany({
      include: { 
        profiles: { 
          include: { 
            user: true,
            roles: true
          } 
        } 
      }
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
    console.log("Código recibido:", code);

    const productora = await prisma.productora.findUnique({
      where: { code: String(code) },
      include: {
        profiles: { 
          include: { 
            user: true, 
            roles: true 
          } 
        },
        eventos: true, 
      },
    });

    if (!productora) {
      return res.status(404).json({ error: "Productora no encontrada" });
    }

    const data = ProductoraResource(productora);
    data.eventos = productora.eventos;
    data.totalEvents = productora.eventos.length;
    data.activeEvents = productora.eventos.filter(e => e.estado === 'ACTIVO').length;

    // Buscamos perfiles que tengan asignado el rol 'ORGANIZER' en roleAsignees
    const organizadores = productora.profiles
      .filter(p => p.roles.some(ra => ra.role === 'ORGANIZADOR'))
      .map(p => p.user);

    data.totalOrganizers = organizadores.length;
    data.organizadores = organizadores.map(user => ({
      id: `O-${user.id.toString().padStart(4, "0")}`,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "Organizador",
      initials: user.name.split(" ").map(n => n[0]).join(""),
      status: "Activo",
    }));

    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al buscar la productora: " + error.message });
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
          email
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

      return [newProductora, newProfile, newRoleAsignado];
    });

    res.status(201).json({ productora, profile, roleAsignado });

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
