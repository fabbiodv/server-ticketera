import  { Router } from "express";

import {
    createRoleAsignee,
}
from "../controllers/roleAsignee.controller.js";

const router = Router();
// Rutas para RoleAsignee
router.post("/", createRoleAsignee);
// router.get("/", getAllRoleAsignees);

export default router;