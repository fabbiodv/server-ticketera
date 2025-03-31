const express = require("express");
const {
  getAllProductoras,
  getProductoraByCode,
  createProductora,
  updateProductora,
  deleteProductora,
} = require("../controllers/productoraController");

const router = express.Router();

router.get("/", getAllProductoras);
router.get("/:code", getProductoraByCode);
router.post("/", createProductora);
router.put("/:id", updateProductora);
router.delete("/:id", deleteProductora);

module.exports = router;
