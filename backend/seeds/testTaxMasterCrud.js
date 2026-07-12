import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import TaxMaster from "../models/TaxMaster.js";
import {
  createTaxHandler,
  deactivateTaxHandler,
  listTaxesHandler,
  updateTaxHandler,
} from "../controllers/taxMasterController.js";

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

  console.log("[test] Tax master CRUD API (Sheet 03 row 10)");

  const suffix = Date.now().toString().slice(-6);
  let taxId;

  try {
    const createRes = mockRes();
    await createTaxHandler(
      request({
        body: {
          name: `CRUD Test GST ${suffix}`,
          rate: 18,
          applies_to: "service",
        },
      }),
      createRes
    );
    taxId = createRes.body.data.id.toString();
    console.log("[test] POST /taxes:", createRes.statusCode);

    const updateRes = mockRes();
    await updateTaxHandler(
      request({
        params: { id: taxId },
        body: { rate: 5, applies_to: "both" },
      }),
      updateRes
    );
    console.log(
      "[test] PATCH /taxes/:id:",
      updateRes.body.data.rate,
      updateRes.body.data.applies_to
    );

    const serviceListRes = mockRes();
    await listTaxesHandler(
      request({ query: { applies_to: "service", is_active: "true" } }),
      serviceListRes
    );
    const foundInService = serviceListRes.body.data.some(
      (tax) => String(tax.id) === taxId
    );
    console.log("[test] GET /taxes?applies_to=service includes test tax:", foundInService);

    const deactivateRes = mockRes();
    await deactivateTaxHandler(request({ params: { id: taxId } }), deactivateRes);
    console.log(
      "[test] DELETE /taxes/:id soft-deactivated:",
      deactivateRes.body.data.is_active === false
    );

    console.log("[test] Done");
  } finally {
    if (taxId) {
      await TaxMaster.deleteOne({ _id: taxId });
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
