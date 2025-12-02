import Router from 'express';
import {
  getAllEntradas,
  getEntradaById,
  createEntrada,
  deleteEntrada,
  escanearQREntrada,
  consumirEntrada,
  getEstadisticasEscaneo
} from "../controllers/entrada.controller.js";
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Rutas para gestión general de entradas
router.get("/", getAllEntradas);
router.get("/:id", getEntradaById);
router.post("/", createEntrada);
router.delete("/:id", deleteEntrada);

// Rutas para escaneo y consumo de QR
router.get("/qr/:qrCode/scan", escanearQREntrada);  // Ver información de entrada por QR
router.post("/qr/:qrCode/consume", authMiddleware, consumirEntrada);  // Consumir entrada
router.get("/evento/:eventoId/estadisticas-escaneo", authMiddleware, getEstadisticasEscaneo);  // Estadísticas de escaneo
export default router;