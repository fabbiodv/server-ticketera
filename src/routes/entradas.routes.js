import Router from 'express';
import {
  getAllEntradas,
  getEntradaById,
  createEntrada,
  deleteEntrada,
} from "../controllers/entrada.controller.js";
const router = Router();
router.get("/", getAllEntradas);
router.get("/:id", getEntradaById);
router.post("/", createEntrada);
router.delete("/:id", deleteEntrada);
export default router;