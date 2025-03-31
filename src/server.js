const express = require("express");
const cors = require("cors");
require("dotenv").config();

const productoraRoutes = require("./src/routes/productoraRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/productoras", productoraRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
