import { Router } from 'express'
import {
  getAllProductoras,
  getProductoraByCode,
  createProductora,
  updateProductora,
  deleteProductora,
} from "../controllers/productora.controller.js";
import { 
  getEstadisticasProductora, 
  getEstadisticasResumidas 
} from "../controllers/productora.stats.controller.js";
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get("/", getAllProductoras);
router.get("/:code", getProductoraByCode);
router.post("/", createProductora);
router.put("/:id", updateProductora);
router.delete("/:id", deleteProductora);

// Rutas para estadísticas
router.get("/:productoraId/stats", authMiddleware, getEstadisticasProductora);  // Estadísticas completas
router.get("/:productoraId/stats/resumen", authMiddleware, getEstadisticasResumidas);  // Estadísticas resumidas

export default router
