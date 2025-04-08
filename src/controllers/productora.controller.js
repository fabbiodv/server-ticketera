import { response } from "express";
import prisma from "../config/database.js";

export const getAllProductoras = async (req, res) => {
  try {
    const productoras = await prisma.productora.findMany({
      include: { profiles: { include: { user: true } } }
    });
    res.json(productoras);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productoras"+error.message
     });
  }
};

export const getProductoraByCode = async (req, res) => {
  try {
    const { code } = req.params;
    console.log("Código recibido:", code);
    const productora = await prisma.productora.findUnique({
      where: { code: code },
      include: {
        profiles: {
          select: {
            user: true, // Selecciona únicamente el campo 'user'
          },
        },
        eventos: true, // Incluye los eventos relacionados
      },
    });

    if (!productora) {
      return res.status(404).json({ error: "Productora no encontrada" });
    }

    res.json(productora);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar la productora: " + error.message });
  }
};

function randomCode(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

export const createProductora = async (req, res) => {
  try {
    const { name, email } = req.body;
    console.log(req.body);
    if (!name || !email) {
      return res.status(400).json({ error: "Todos los campos son obligatorios: name,email" });
    }

    const productora = await prisma.productora.create({
      data: {
        name,
        code: randomCode(6),
        email,
        profiles: {
          create: {
            userId: 1,
            role: "OWNER"
          }
        }
      },
      include: { profiles: true }
    });

    res.status(201).json(productora);
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
