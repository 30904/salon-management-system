import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import ProductMaster from "../models/ProductMaster.js";
import {
  createProductHandler,
  deactivateProductHandler,
  listLowStockProductsHandler,
  listProductsHandler,
  updateProductHandler,
} from "../controllers/productMasterController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function request({ body = {}, params = {}, query = {} } = {}) {
  return { body, params, query };
}

async function run() {
  await connectDB();

  console.log("[test] Product master CRUD API (Sheet 03 row 7)");

  const suffix = Date.now().toString().slice(-6);
  const sku = `CRUD-TEST-${suffix}`;
  let productId;

  try {
    const createRes = mockRes();
    await createProductHandler(
      request({
        body: {
          name: `CRUD Test Product ${suffix}`,
          sku,
          unit: "bottle",
          purchase_price: 100,
          sale_price: 199,
          current_stock: 2,
          reorder_level: 5,
        },
      }),
      createRes
    );
    productId = createRes.body.data.id.toString();
    console.log("[test] POST /products:", createRes.statusCode);
    console.log("[test] is_low_stock:", createRes.body.data.is_low_stock);

    const updateRes = mockRes();
    await updateProductHandler(
      request({
        params: { id: productId },
        body: { sale_price: 249, current_stock: 8 },
      }),
      updateRes
    );
    console.log(
      "[test] PATCH /products/:id:",
      updateRes.body.data.sale_price,
      updateRes.body.data.current_stock,
      updateRes.body.data.is_low_stock
    );

    const listRes = mockRes();
    await listProductsHandler(
      request({ query: { search: suffix, is_active: "true" } }),
      listRes
    );
    console.log("[test] GET /products filtered:", listRes.body.data.length);

    await updateProductHandler(
      request({
        params: { id: productId },
        body: { current_stock: 1, reorder_level: 4 },
      }),
      mockRes()
    );

    const lowStockRes = mockRes();
    await listLowStockProductsHandler(request(), lowStockRes);
    const found = lowStockRes.body.data.some(
      (product) => String(product.id) === productId
    );
    console.log("[test] GET /products/low-stock includes test product:", found);

    const deactivateRes = mockRes();
    await deactivateProductHandler(
      request({ params: { id: productId } }),
      deactivateRes
    );
    console.log(
      "[test] DELETE /products/:id soft-deactivated:",
      deactivateRes.body.data.is_active === false
    );

    console.log("[test] Done");
  } finally {
    if (productId) {
      await ProductMaster.deleteOne({ _id: productId });
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
