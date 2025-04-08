import { Router } from "express";
import {
  getTiposEntrada,
  createTipoEntrada,
  getTipoEntradaById,
  updateTipoEntrada,
  deleteTipoEntrada,
} from "../controllers/tipoEntrada.controller.js";

const router = Router();
router.get("/", getTiposEntrada);
router.get("/:id", getTipoEntradaById);
router.post("/", createTipoEntrada);
router.put("/:id", updateTipoEntrada);
router.delete("/:id", deleteTipoEntrada);
export default router;