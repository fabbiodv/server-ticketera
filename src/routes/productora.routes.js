import { Router } from 'express'
import {
  getAllProductoras,
  getProductoraByCode,
  createProductora,
  updateProductora,
  deleteProductora,
} from "../controllers/productora.controller.js";

const router = Router();

router.get("/", getAllProductoras);
router.get("/:code", getProductoraByCode);
router.post("/", createProductora);
router.put("/:id", updateProductora);
router.delete("/:id", deleteProductora);

export default router
