import { Router } from "express";
import {
  getAllEventos,
  createEvento,
  getEventoById,
  updateEvento,
  getEventosByProductora,
  deleteEvento,
  getMyEventos
} from "../controllers/evento.controller.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/:id", getEventoById);
router.get("/", getAllEventos);
router.get("/my-eventos", authenticateToken, getMyEventos); 
router.get("/productora/:id", getEventosByProductora);
router.post("/", createEvento);
router.put("/:id", updateEvento);       
router.delete("/:id", deleteEvento);
export default router;
