/**
 * Payroll Stage E test (tracker row 30):
 * Mount payroll routes on arnavRoutes (not preciousRoutes).
 *
 * Usage:
 *   npm run test:payroll-routes-mount
 */
import arnavRoutes from "../routes/arnavRoutes.js";
import preciousRoutes from "../routes/preciousRoutes.js";
import apiRoutes from "../routes/index.js";
import payrollRoutes from "../routes/payrollRoutes.js";

function isMounted(router, child) {
  return router.stack.some((layer) => layer.handle === child);
}

async function dispatchApi({ method, url }) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseData = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return mockRes;
      },
      json(data) {
        responseData = data;
        resolve({ statusCode, data: responseData });
        return mockRes;
      },
    };

    apiRoutes.handle(
      { method, url, headers: {}, body: {}, query: {} },
      mockRes,
      (err) => {
        resolve({ statusCode: err?.statusCode || 500, data: null, err });
      }
    );
  });
}

async function main() {
  console.log("[test] payroll routes mount\n");

  if (!isMounted(arnavRoutes, payrollRoutes)) {
    throw new Error("Expected payrollRoutes mounted on arnavRoutes at /payroll");
  }
  console.log("  PASS: payrollRoutes mounted on arnavRoutes");

  if (isMounted(preciousRoutes, payrollRoutes)) {
    throw new Error("payrollRoutes must not be mounted on preciousRoutes (Leave lives there)");
  }
  console.log("  PASS: payrollRoutes not on preciousRoutes");

  if (!isMounted(apiRoutes, arnavRoutes)) {
    throw new Error("Expected arnavRoutes mounted on /api index router");
  }
  console.log("  PASS: arnavRoutes still mounted via routes/index.js");

  const unauth = await dispatchApi({ method: "POST", url: "/payroll/run" });
  const unauthStatus = unauth.err?.statusCode || unauth.statusCode;
  if (unauthStatus !== 401) {
    throw new Error(`Expected 401 on /api/payroll/run without token, got ${unauthStatus}`);
  }
  console.log("  PASS: /api/payroll/run reachable through API index (401 without auth)");

  console.log("\n[test] payroll routes mount passed");
}

main().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
