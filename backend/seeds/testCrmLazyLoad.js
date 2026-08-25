/**
 * Feature 2 tracker row 31 — CRM lazy load after ~3000 seed.
 * Verifies paginated GET /customers, page 2 append shape, search page cap,
 * and typeahead-only search API (POS pattern). No PII logged.
 *
 * Usage:
 *   npm run test:crm-lazy-load
 */
import dotenv from "dotenv";
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import Customer from "../models/Customer.js";
import {
  CUSTOMER_LIST_MAX_PAGE_SIZE,
  CUSTOMER_LIST_PAGE_SIZE,
} from "../constants/customerConstants.js";
import {
  listCustomersHandler,
  searchCustomersHandler,
} from "../controllers/customerController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

const POS_SCREEN = path.resolve(
  __dirname,
  "../../frontend/src/pages/billing/PosScreen.jsx"
);

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

function request({ query = {} } = {}) {
  return { query, body: {}, params: {} };
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

async function callList(query = {}) {
  const res = mockRes();
  await listCustomersHandler(request({ query }), res);
  if (!res.body?.success) {
    throw new Error(res.body?.message || "listCustomersHandler failed");
  }
  return res.body.data;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  await connectDB();

  console.log("[test] CRM lazy load — 3000-row first paint (Feature 2 row 31)\n");

  const dbTotal = await Customer.countDocuments({});
  assert(dbTotal > 0, "DB has customers (run seed:client-customers first)");

  const page1 = await callList({ page: 1 });
  const page1Ids = page1.items.map((row) => String(row.id));

  assert(Array.isArray(page1.items), "Page 1 returns items array");
  assert(
    page1.items.length <= CUSTOMER_LIST_PAGE_SIZE,
    `Page 1 items (${page1.items.length}) <= CUSTOMER_LIST_PAGE_SIZE (${CUSTOMER_LIST_PAGE_SIZE})`
  );
  assert(
    page1.items.length === Math.min(CUSTOMER_LIST_PAGE_SIZE, dbTotal),
    `Page 1 returns min(pageSize, dbTotal) = ${Math.min(CUSTOMER_LIST_PAGE_SIZE, dbTotal)}`
  );
  assert(page1.total === dbTotal, `Page 1 total (${page1.total}) equals DB count (${dbTotal})`);
  assert(page1.page === 1, "Page 1 page index is 1");
  assert(page1.pageSize === CUSTOMER_LIST_PAGE_SIZE, "Page 1 pageSize is default 25");
  assert(
    page1.hasMore === dbTotal > CUSTOMER_LIST_PAGE_SIZE,
    `Page 1 hasMore=${page1.hasMore} matches dbTotal > pageSize`
  );
  assert(
    page1.items.length < dbTotal || dbTotal <= CUSTOMER_LIST_PAGE_SIZE,
    "First paint payload is not the full DB (items < total unless tiny DB)"
  );

  if (dbTotal > CUSTOMER_LIST_PAGE_SIZE) {
    const page2 = await callList({ page: 2 });
    const page2Ids = page2.items.map((row) => String(row.id));

    assert(page2.page === 2, "Page 2 page index is 2");
    assert(page2.items.length > 0, "Page 2 returns at least one item");
    assert(
      page2.items.length <= CUSTOMER_LIST_PAGE_SIZE,
      `Page 2 items (${page2.items.length}) <= page size`
    );
    assert(
      page1Ids[0] !== page2Ids[0],
      "Page 2 first item differs from page 1 (not duplicate first page)"
    );
    assert(
      !page1Ids.includes(page2Ids[0]),
      "Page 2 row not duplicated from page 1 start"
    );
  } else {
    console.log("  SKIP: DB smaller than page size — page 2 not required");
  }

  const sample = page1.items.find((row) => row.name && row.phone);
  assert(Boolean(sample), "Page 1 has a row with name + phone for search test");

  const nameTerm = escapeRegex(String(sample.name).trim().slice(0, 4));
  const phoneTerm = String(sample.phone).trim().slice(0, 4);

  for (const [label, term] of [
    ["name", nameTerm],
    ["phone", phoneTerm],
  ]) {
    if (!term || term.length < 2) continue;
    const searchPage = await callList({ search: term, page: 1 });
    assert(
      searchPage.items.length <= CUSTOMER_LIST_PAGE_SIZE,
      `Search by ${label} returns <= ${CUSTOMER_LIST_PAGE_SIZE} items (not whole DB)`
    );
    assert(
      searchPage.total <= dbTotal,
      `Search by ${label} total (${searchPage.total}) <= DB total (${dbTotal})`
    );
    assert(
      searchPage.items.length <= searchPage.total,
      `Search by ${label} items length <= search total`
    );
  }

  const shortSearchRes = mockRes();
  try {
    await searchCustomersHandler(request({ query: { q: "a" } }), shortSearchRes);
    assert(false, "searchCustomers rejects query shorter than 2 chars");
  } catch (err) {
    assert(
      String(err.message || "").toLowerCase().includes("at least 2"),
      "searchCustomers rejects query shorter than 2 chars"
    );
  }

  const typeaheadRes = mockRes();
  await searchCustomersHandler(
    request({ query: { q: phoneTerm, limit: 500 } }),
    typeaheadRes
  );
  const typeaheadRows = typeaheadRes.body?.data || [];
  assert(
    typeaheadRows.length <= CUSTOMER_LIST_MAX_PAGE_SIZE,
    `Typeahead search capped at ${CUSTOMER_LIST_MAX_PAGE_SIZE} (got ${typeaheadRows.length})`
  );
  assert(
    typeaheadRows.length < dbTotal || dbTotal <= CUSTOMER_LIST_MAX_PAGE_SIZE,
    "Typeahead does not return full DB when DB is large"
  );

  const posSource = fs.readFileSync(POS_SCREEN, "utf8");
  assert(
    posSource.includes("searchCustomers") && !posSource.includes("listCustomers"),
    "POS PosScreen.jsx uses searchCustomers only (typeahead — no list-all)"
  );

  console.log(
    JSON.stringify(
      {
        db_total: dbTotal,
        page1_items: page1.items.length,
        page1_total: page1.total,
        page1_hasMore: page1.hasMore,
        typeahead_sample_count: typeaheadRows.length,
      },
      null,
      2
    )
  );

  await Customer.db.close();
  console.log("\n[test] CRM lazy load verify passed");
}

main().catch(async (err) => {
  console.error("\n[test] FAILED:", err.message || err);
  try {
    await Customer.db.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
