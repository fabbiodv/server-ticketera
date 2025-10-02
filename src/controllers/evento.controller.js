import { PrismaClient } from "@prisma/client/extension";
import prisma from "../config/database.js";


export const getAllEventos = async (req, res) => {
  try {
    const {
      page, limit, sortBy = 'date', sortOrder = 'asc',
      name, location, productoraId, status,
      dateFrom, dateTo, capacity, minCapacity, maxCapacity,
      ...otherFilters
    } = req.query;

    const eventos = await prisma.eventos.findMany({
      where: {
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(location && { location: { contains: location, mode: 'insensitive' } }),
        ...(productoraId && { productoraId: parseInt(productoraId) }),
        ...(status && { status }),
        ...(capacity && { capacity: parseInt(capacity) }),
        ...(minCapacity && { capacity: { gte: parseInt(minCapacity) } }),
        ...(maxCapacity && { capacity: { lte: parseInt(maxCapacity) } }),
        ...((dateFrom || dateTo) && {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) })
          }
        }),

        // Filtros adicionales dinámicos
        ...Object.fromEntries(
          Object.entries(otherFilters)
            .filter(([_, value]) => value)
            .map(([key, value]) => [key, { contains: value, mode: 'insensitive' }])
        )
      },
      include: {
        productora: { select: { name: true, code: true } },
        tipoEntrada: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            estado: true,
            disponible: true,
            totalEntradas: true
          }
        },
        _count: {
          select: {
            tipoEntrada: true,
            Entrada: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      ...(limit && {
        skip: ((parseInt(page) || 1) - 1) * parseInt(limit),
        take: parseInt(limit)
      })
    });

    res.json(eventos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eventos: ' + error.message });
  }
};

export const getEventoById = async(req, res) => {
    try{
        const prisma = new PrismaClient();
        const { id } = req.params;
        const evento = await prisma.evento.findUnique({
            where: { id: Number(id) },
            include: {
                productora: true,
                
            }
        });
        if(!evento){
            return res.status(404).json({ message: "Evento no encontrado" });
        }
        res.status(200).json(evento);
    }catch(error){
        // console.error("Error al obtener evento:", error);
        res.status(500).json({ error: "Error al obtener evento" });
    }
}

export const getEventosByProductora = async (req, res) => {
    try {
        const { id } = req.params;
        const eventos = await prisma.eventos.findMany({
            where: { productoraId: Number(id) },
            include: {
                productora: true,
                tipoEntrada: true
            }
        });
        if (!eventos || eventos.length === 0) {
            return res.status(404).json({ message: "No se encontraron eventos para esta productora" });
        }
        res.status(200).json(eventos);
    } catch (error) {
        // console.error("Error al obtener eventos por productora:", error);
        res.status(500).json({ error: "Error al obtener eventos por productora", details: error.message });
    }
}

export const createEvento = async (req, res) => {
    try {
      const { name,date,startTime,endTime,description,location,capacity, productoraId,tiposEntrada} = req.body;
  
      // Validación de campos requeridos
      if (!name || !date || !startTime || !endTime || !location || !productoraId  || !capacity ) {
        return res.status(400).json({
          error: "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, capacity, productoraId"
        });
      }
  
      const evento = await prisma.eventos.create({
        data: {
          name,
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          description,
          location,
          capacity: Number(capacity),
          productoraId: Number(productoraId),
          ...(Array.isArray(tiposEntrada) && tiposEntrada.length > 0 && {
            tipoEntrada: {
              create: tiposEntrada.map(tipo => ({
                nombre: tipo.nombre,
                precio: tipo.precio,
                totalEntradas: tipo.totalEntradas,
                maximoEntradasPorPersona: tipo.maximoEntradasPorPersona
              }))
            }
          })          
        },
        include: {
          productora: true,
          tipoEntrada: true
        }
      });
  
      res.status(201).json({
        message: "Evento creado exitosamente",
        evento
      });
  
    } catch (error) {
      console.error("Error al crear evento:", error);
      res.status(500).json({
        error: "Error al crear el evento",
        details: error.message
      });
    }
  };

export const updateEvento = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, startTime, endTime, description, location, capacity, productoraId } = req.body;
  
        // Validación de campos requeridos
        if (!name || !date || !startTime || !endTime || !location || !capacity || !productoraId) {
          return res.status(400).json({
            error: "Todos los campos son obligatorios: name, date, startTime, endTime, description, location, capacity, productoraId"
          });
        }
  
        const evento = await prisma.eventos.update({
          where: { id: Number(id) },
          data: {
            name,
            date: new Date(date),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            description,
            location,
            capacity: Number(capacity),
            productoraId: Number(productoraId)
          },
          include: {
            productora: true,
            tipoEntrada: true
          }
        });
  
        res.status(200).json({
          message: "Evento actualizado exitosamente",
          evento
        });
  
      } catch (error) {
        console.error("Error al actualizar evento:", error);
        res.status(500).json({
          error: "Error al actualizar el evento",
          details: error.message
        });
      }
  }
export const deleteEvento = async (req, res) => {
    try {
        const prisma = new PrismaClient();
        const { id } = req.params;
        const evento = await prisma.evento.delete({
            where: { id: Number(id) },
        });
        res.status(200).json({ message: "Evento eliminado exitosamente", evento });
    } catch (error) {
        console.error("Error al eliminar evento:", error);
        res.status(500).json({ error: "Error al eliminar evento" });
    }
}
