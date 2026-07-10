import { Router } from "express";
import arnavRoutes from "./arnavRoutes.js";
import preciousRoutes from "./preciousRoutes.js";

const router = Router();

// Single API entry — server.js mounts only this file.
// Arnav adds modules in arnavRoutes.js; Precious adds modules in preciousRoutes.js.
router.use(arnavRoutes);
router.use(preciousRoutes);

export default router;
