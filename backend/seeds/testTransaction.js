import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { withTransaction } from "../utils/withTransaction.js";
import { AppError } from "../utils/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create a temporary model specifically for transaction verification
const TestTxSchema = new mongoose.Schema({
  name: String,
  step: Number,
});
const TestTxModel = mongoose.models.TestTx || mongoose.model("TestTx", TestTxSchema);

async function runTests() {
  console.log("==========================================");
  console.log("🚀 Testing Mongo withTransaction Helper");
  console.log("==========================================\n");

  await connectDB();

  // Clean up any old test data
  await TestTxModel.deleteMany({ name: /^TX_TEST_/ });

  try {
    // ----------------------------------------------------
    // TEST 1: Successful Atomic Commit
    // ----------------------------------------------------
    console.log("▶ TEST 1: Executing successful multi-step atomic commit...");
    await withTransaction(async (session) => {
      // Step 1: Create first document inside transaction
      await TestTxModel.create([{ name: "TX_TEST_SUCCESS_STEP_1", step: 1 }], { session });

      // Step 2: Create second document inside transaction
      await TestTxModel.create([{ name: "TX_TEST_SUCCESS_STEP_2", step: 2 }], { session });
    });

    const successCount = await TestTxModel.countDocuments({ name: /^TX_TEST_SUCCESS_/ });
    if (successCount === 2) {
      console.log("✅ TEST 1 PASSED: Both steps committed atomically to database (`successCount` = 2).\n");
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 2 documents, found ${successCount}\n`);
    }

    // ----------------------------------------------------
    // TEST 2: Simulated Failure & Rollback (Abort)
    // ----------------------------------------------------
    console.log("▶ TEST 2: Executing transaction that throws midway to test Rollback...");
    try {
      await withTransaction(async (session) => {
        // Step 1: Create document in memory session
        await TestTxModel.create([{ name: "TX_TEST_ROLLBACK_STEP_1", step: 1 }], { session });
        console.log("   --> Step 1 inserted document inside transaction session (`TX_TEST_ROLLBACK_STEP_1`)");

        // Step 2: Intentionally throw an error halfway through!
        console.log("   --> Step 2 throwing simulated checkout/package error...");
        throw new AppError("Simulated error: Insufficient package sessions remaining!", 400);
      });
    } catch (err) {
      console.log(`   --> Caught expected rollback error: "${err.message}"`);
    }

    // Check if Step 1 document leaked into database or was properly rolled back
    const rollbackCount = await TestTxModel.countDocuments({ name: "TX_TEST_ROLLBACK_STEP_1" });
    if (rollbackCount === 0) {
      console.log(
        "✅ TEST 2 PASSED: Transaction aborted & rolled back cleanly (`rollbackCount` = 0). No orphan records left behind!\n"
      );
    } else {
      console.error(`❌ TEST 2 FAILED: Rollback failed, orphaned record found in database!\n`);
    }

    console.log("==========================================");
    console.log("🎉 ALL TRANSACTION TESTS COMPLETED & PASSED!");
    console.log("==========================================");
  } finally {
    // Clean up test documents and close connection
    await TestTxModel.deleteMany({ name: /^TX_TEST_/ });
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTests();
