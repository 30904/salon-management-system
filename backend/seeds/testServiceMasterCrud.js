import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";
import {
  createServiceCategoryHandler,
  createServiceHandler,
  deactivateServiceCategoryHandler,
  deactivateServiceHandler,
  listServiceCategoriesHandler,
  listServicesHandler,
  updateServiceHandler,
} from "../controllers/serviceMasterController.js";

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

  console.log("[test] Service master CRUD API (Sheet 03 row 4)");

  const suffix = Date.now().toString();
  let categoryId;

  try {
    const categoryRes = mockRes();
    await createServiceCategoryHandler(
      request({ body: { name: `CRUD Test Category ${suffix}` } }),
      categoryRes
    );
    categoryId = categoryRes.body.data.id.toString();
    console.log("[test] POST /service-categories:", categoryRes.statusCode);

    const serviceRes = mockRes();
    await createServiceHandler(
      request({
        body: {
          category_id: categoryId,
          name: `CRUD Test Service ${suffix}`,
          duration_minutes: 45,
          price: 750,
        },
      }),
      serviceRes
    );
    const serviceId = serviceRes.body.data.id.toString();
    console.log("[test] POST /services:", serviceRes.statusCode);

    const updateRes = mockRes();
    await updateServiceHandler(
      request({
        params: { id: serviceId },
        body: { duration_minutes: 60, price: 900 },
      }),
      updateRes
    );
    console.log(
      "[test] PATCH /services/:id:",
      updateRes.body.data.duration_minutes,
      updateRes.body.data.price
    );

    const servicesRes = mockRes();
    await listServicesHandler(
      request({ query: { category_id: categoryId, is_active: "true" } }),
      servicesRes
    );
    console.log("[test] GET /services filtered:", servicesRes.body.data.length);

    const deactivateServiceRes = mockRes();
    await deactivateServiceHandler(
      request({ params: { id: serviceId } }),
      deactivateServiceRes
    );
    console.log(
      "[test] DELETE /services/:id soft-deactivated:",
      deactivateServiceRes.body.data.is_active === false
    );

    const deactivateCategoryRes = mockRes();
    await deactivateServiceCategoryHandler(
      request({ params: { id: categoryId } }),
      deactivateCategoryRes
    );
    console.log(
      "[test] DELETE /service-categories/:id soft-deactivated:",
      deactivateCategoryRes.body.data.is_active === false
    );

    const categoriesRes = mockRes();
    await listServiceCategoriesHandler(
      request({ query: { is_active: "false", search: suffix } }),
      categoriesRes
    );
    console.log(
      "[test] GET /service-categories filtered:",
      categoriesRes.body.data.length
    );

    console.log("[test] Done");
  } finally {
    if (categoryId) {
      await ServiceMaster.deleteMany({ category_id: categoryId });
      await ServiceCategory.deleteOne({ _id: categoryId });
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
