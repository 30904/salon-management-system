import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import "../models/User.js";
import Customer from "../models/Customer.js";
import {
  createCustomerHandler,
  findOrCreateCustomerHandler,
  getCustomerHandler,
  searchCustomersHandler,
  updateCustomerHandler,
} from "../controllers/customerController.js";

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

  console.log("[test] Customer CRUD API (Sheet 03 row 24)");

  const suffix = Date.now().toString().slice(-7);
  const phone = `91${suffix}`;
  let customerId;

  try {
    const createRes = mockRes();
    await createCustomerHandler(
      request({
        body: {
          name: `CRUD Test Customer ${suffix}`,
          phone,
          gender: "female",
          tags: [{ label: "Walk-in", type: "manual" }],
        },
      }),
      createRes
    );
    customerId = createRes.body.data.id.toString();
    console.log("[test] POST /customers:", createRes.statusCode);

    const searchRes = mockRes();
    await searchCustomersHandler(
      request({ query: { q: suffix } }),
      searchRes
    );
    console.log("[test] GET /customers/search:", searchRes.body.data.length);

    const findRes = mockRes();
    await findOrCreateCustomerHandler(
      request({
        body: {
          phone,
          name: "Should Not Replace",
        },
      }),
      findRes
    );
    console.log(
      "[test] POST /customers/find-or-create existing:",
      findRes.body.data.created === false
    );

    const createNewRes = mockRes();
    const newPhone = `92${suffix}`;
    await findOrCreateCustomerHandler(
      request({
        body: {
          phone: newPhone,
          name: `Auto Created ${suffix}`,
        },
      }),
      createNewRes
    );
    console.log(
      "[test] POST /customers/find-or-create new:",
      createNewRes.body.data.created === true
    );

    const updateRes = mockRes();
    await updateCustomerHandler(
      request({
        params: { id: customerId },
        body: { notes: "Updated from CRUD test" },
      }),
      updateRes
    );
    console.log("[test] PATCH /customers/:id notes:", updateRes.body.data.notes);

    const getRes = mockRes();
    await getCustomerHandler(request({ params: { id: customerId } }), getRes);
    console.log("[test] GET /customers/:id:", getRes.body.data.name);

    console.log("[test] Done");
  } finally {
    await Customer.deleteMany({
      phone: { $in: [phone, `92${suffix}`] },
    });
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
