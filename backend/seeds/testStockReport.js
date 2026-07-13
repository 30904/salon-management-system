import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import ProductMaster from "../models/ProductMaster.js";
import { getStockReportHandler } from "../controllers/inventoryController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  await connectDB();
  console.log("[test] Starting Inventory Stock Report (`testStockReport.js`) Tests...\n");

  // 1. Clean up old test products
  console.log("[test] 1. Setting up test products in ProductMaster...");
  await ProductMaster.deleteMany({
    sku: { $in: ["SKU-REP-INSTOCK", "SKU-REP-LOWSTOCK", "SKU-REP-OUTSTOCK", "SKU-REP-INACTIVE"] },
  });

  await ProductMaster.create([
    {
      name: "Test Shampoo In-Stock",
      sku: "SKU-REP-INSTOCK",
      unit: "bottle",
      purchase_price: 100,
      sale_price: 200,
      current_stock: 50,
      reorder_level: 10,
      is_active: true,
    },
    {
      name: "Test Serum Low-Stock",
      sku: "SKU-REP-LOWSTOCK",
      unit: "piece",
      purchase_price: 300,
      sale_price: 500,
      current_stock: 5,
      reorder_level: 15,
      is_active: true,
    },
    {
      name: "Test Hair Mask Out-of-Stock",
      sku: "SKU-REP-OUTSTOCK",
      unit: "jar",
      purchase_price: 250,
      sale_price: 400,
      current_stock: 0,
      reorder_level: 5,
      is_active: true,
    },
    {
      name: "Test Discontinued Item",
      sku: "SKU-REP-INACTIVE",
      unit: "box",
      purchase_price: 500,
      sale_price: 800,
      current_stock: 2,
      reorder_level: 10,
      is_active: false, // should NOT appear in standard active stock report
    },
  ]);
  console.log("       Test products created successfully.\n");

  // 2. Execute getStockReportHandler via simulated Express req/res
  console.log("[test] 2. Executing `getStockReportHandler` (status = all)...");
  const req = { query: { search: "SKU-REP-" } };
  let responseData = null;
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (payload) {
      responseData = payload;
      return this;
    },
  };

  await getStockReportHandler(req, res, (err) => {
    if (err) throw err;
  });

  if (!responseData || !responseData.success) {
    throw new Error("Handler failed to return success response");
  }

  const { summary, reorder_alerts, products } = responseData.data;

  console.log("       [Report Summary KPIs]");
  console.log(`         -> total_products                : ${summary.total_products} (Expected: 3 active test products)`);
  console.log(`         -> total_stock_units             : ${summary.total_stock_units} (Expected: 55 = 50+5+0)`);
  console.log(`         -> total_stock_value_at_purchase : ₹${summary.total_stock_value_at_purchase} (Expected: 6500)`);
  console.log(`         -> total_stock_value_at_sale     : ₹${summary.total_stock_value_at_sale} (Expected: 12500)`);
  console.log(`         -> low_stock_count               : ${summary.low_stock_count} (Expected: 1)`);
  console.log(`         -> out_of_stock_count            : ${summary.out_of_stock_count} (Expected: 1)`);
  console.log(`         -> reorder_alerts_count          : ${summary.reorder_alerts_count} (Expected: 2)`);

  if (
    summary.total_products !== 3 ||
    summary.total_stock_units !== 55 ||
    summary.total_stock_value_at_purchase !== 6500 ||
    summary.total_stock_value_at_sale !== 12500 ||
    summary.low_stock_count !== 1 ||
    summary.out_of_stock_count !== 1 ||
    summary.reorder_alerts_count !== 2
  ) {
    throw new Error("Summary KPIs mismatch!");
  }
  console.log("         -> Summary KPIs PASSED\n");

  // 3. Verify Reorder Alerts & Sorting
  console.log("[test] 3. Verifying Reorder Alerts list & priority sorting...");
  console.log(`       Alert 1: [${reorder_alerts[0].status}] ${reorder_alerts[0].name} (Deficit: ${reorder_alerts[0].deficit}, Rec Qty: ${reorder_alerts[0].recommended_order_quantity})`);
  console.log(`         Message: "${reorder_alerts[0].alert_message}"`);
  console.log(`       Alert 2: [${reorder_alerts[1].status}] ${reorder_alerts[1].name} (Deficit: ${reorder_alerts[1].deficit}, Rec Qty: ${reorder_alerts[1].recommended_order_quantity})`);
  console.log(`         Message: "${reorder_alerts[1].alert_message}"`);

  if (reorder_alerts[0].status !== "out_of_stock" || reorder_alerts[0].sku !== "SKU-REP-OUTSTOCK") {
    throw new Error("Expected Out-of-Stock item to be sorted first in reorder_alerts!");
  }
  if (reorder_alerts[1].status !== "low_stock" || reorder_alerts[1].sku !== "SKU-REP-LOWSTOCK") {
    throw new Error("Expected Low-Stock item to be sorted second!");
  }
  if (reorder_alerts[1].recommended_order_quantity !== 20) {
    // deficit = 15 - 5 = 10 -> recommended = 10 * 2 = 20
    throw new Error(`Expected recommended order qty to be 20, got ${reorder_alerts[1].recommended_order_quantity}`);
  }
  console.log("       -> Reorder alerts verification PASSED\n");

  // 4. Test Filtering (?status=out_of_stock)
  console.log("[test] 4. Testing filter parameter `status=out_of_stock`...");
  const reqFilter = { query: { search: "SKU-REP-", status: "out_of_stock" } };
  let responseFilterData = null;
  const resFilter = {
    status: function () { return this; },
    json: function (payload) { responseFilterData = payload; return this; },
  };

  await getStockReportHandler(reqFilter, resFilter, (err) => { if (err) throw err; });
  const filteredProducts = responseFilterData.data.products;
  console.log(`       Filtered Products Count: ${filteredProducts.length} (Expected: 1)`);
  if (filteredProducts.length !== 1 || filteredProducts[0].sku !== "SKU-REP-OUTSTOCK") {
    throw new Error("Status filter failed");
  }
  console.log("       -> Status filtering PASSED\n");

  // 5. Cleanup
  console.log("[test] 5. Cleaning up test products...");
  await ProductMaster.deleteMany({
    sku: { $in: ["SKU-REP-INSTOCK", "SKU-REP-LOWSTOCK", "SKU-REP-OUTSTOCK", "SKU-REP-INACTIVE"] },
  });
  console.log("       Cleaned up.\n");

  console.log("[test] All Stock Report (`testStockReport.js`) tests passed successfully! ✨");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n[test] Test failed:", err.message || err);
  process.exit(1);
});
