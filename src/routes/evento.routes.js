import { Router } from "express";
import {
  getAllEventos,
  createEvento,
  getEventoById,
  updateEvento,
  deleteEvento,
} from "../controllers/evento.controller.js";

const router = Router();

router.get("/", getAllEventos);
router.get("/:id", getEventoById);
router.post("/", createEvento);
router.put("/:id", updateEvento);       
router.delete("/:id", deleteEvento);
export default router;
