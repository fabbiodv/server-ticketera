import { Router } from "express";
import {
  getAllEventos,
  createEvento,
  getEventoById,
  updateEvento,
  getEventosByProductora,
  deleteEvento,
  getMyEventos,
} from "../controllers/evento.controller.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Rutas específicas primero (antes de las rutas con parámetros dinámicos)
router.get("/", getAllEventos);
router.get("/my-eventos", authenticateToken, getMyEventos);
router.get("/productora/:id", getEventosByProductora);
router.post("/", createEvento);

// Rutas con parámetros dinámicos al final
router.get("/:id", getEventoById);
router.put("/:id", updateEvento);
router.delete("/:id", deleteEvento);

export default router;
