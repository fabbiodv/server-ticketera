import { Router } from "express";
import {
  getAllEventos,
  createEvento,
  getEventoById,
  updateEvento,
  getEventosByProductora,
  deleteEvento,
} from "../controllers/evento.controller.js";

const router = Router();

router.get("/", getAllEventos);
router.get("/:id", getEventoById);
router.get("/productora/:id", getEventosByProductora);
router.post("/", createEvento);
router.put("/:id", updateEvento);       
router.delete("/:id", deleteEvento);
export default router;
