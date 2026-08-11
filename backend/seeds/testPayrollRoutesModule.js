/**
 * Payroll Stage E test (tracker row 29):
 * routes/payrollRoutes.js — new payroll API module
 * (auth middleware + declared endpoints; mount is row 30).
 *
 * Usage:
 *   npm run test:payroll-routes-module
 */
import payrollRoutes from "../routes/payrollRoutes.js";

function declaredRoutes() {
  return payrollRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).sort(),
    }));
}

async function dispatch({ method, url, headers = {}, body = {}, query = {} }) {
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

    payrollRoutes.handle(
      { method, url, headers, body, query },
      mockRes,
      (err) => {
        resolve({ statusCode: err?.statusCode || 500, data: null, err });
      }
    );
  });
}

function assertRoute(routes, path, method) {
  const found = routes.find((r) => r.path === path && r.methods.includes(method));
  if (!found) {
    throw new Error(`Expected ${method.toUpperCase()} ${path} on payrollRoutes`);
  }
}

async function main() {
  console.log("[test] payrollRoutes module\n");

  if (typeof payrollRoutes !== "function" || !Array.isArray(payrollRoutes.stack)) {
    throw new Error("Expected payrollRoutes to export an Express router");
  }
  console.log("  PASS: payrollRoutes exports an Express router");

  const hasAuth = payrollRoutes.stack.some((layer) => !layer.route && typeof layer.handle === "function");
  if (!hasAuth) {
    throw new Error("Expected router.use(authenticate) on payrollRoutes");
  }
  console.log("  PASS: authenticate middleware registered");

  const routes = declaredRoutes();
  assertRoute(routes, "/run", "post");
  assertRoute(routes, "/run/:id", "get");
  assertRoute(routes, "/run/:id/finalize", "post");
  assertRoute(routes, "/staff/:staffId", "get");
  console.log("  PASS: Stage E payroll endpoints declared");

  const unauth = await dispatch({ method: "POST", url: "/run", body: { month: 1, year: 2090 } });
  const unauthStatus = unauth.err?.statusCode || unauth.statusCode;
  if (unauthStatus !== 401) {
    throw new Error(`Expected 401 without token, got ${unauthStatus}`);
  }
  console.log("  PASS: unauthenticated request rejected");

  console.log("\n[test] payrollRoutes module passed");
}

main().catch((error) => {
  console.error("[test] Failed:", error.message);
  process.exit(1);
});
