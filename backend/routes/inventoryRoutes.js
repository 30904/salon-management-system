import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import ProductMaster from "../models/ProductMaster.js";

const router = Router();

// Inventory & Stock Management module
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const products = await ProductMaster.find().sort({ name: 1 });
    res.json({
      success: true,
      data: products,
      message: "Inventory retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
