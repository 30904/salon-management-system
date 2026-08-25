/**
 * Feature 4 tracker row 12 — redoRoutes live on preciousRoutes (full surface).
 *
 * Usage:
 *   npm run test:redo-routes-mounted
 */
import redoRoutes from "../routes/redoRoutes.js";
import preciousRoutes from "../routes/preciousRoutes.js";
import {
  listRedoRequests,
  getRedoRequestById,
} from "../services/redoService.js";

function assert(cond, label) {
  if (!cond) throw new Error(label);
  console.log(`  PASS: ${label}`);
}

function collectPaths(stack, prefix = "") {
  const paths = [];
  for (const layer of stack || []) {
    if (layer.route?.path != null) {
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      for (const method of methods) {
        paths.push(`${method} ${prefix}${layer.route.path}`);
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      const mount = layer.regexp?.fast_slash
        ? ""
        : String(layer.regexp || "")
            .replace("/^\\", "")
            .replace("\\/?(?=\\/|$)/i", "")
            .replace(/\\\//g, "/")
            .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":param");
      // Prefer layer keys when available
      const mountPath =
        layer.keys?.length >= 0 && layer.regexp?.toString?.().includes("redo")
          ? "/redo"
          : "";
      paths.push(...collectPaths(layer.handle.stack, mountPath || prefix));
    }
  }
  return paths;
}

console.log("[test] Feature 4 redo routes mounted (row 12)\n");

assert(typeof listRedoRequests === "function", "listRedoRequests exported");
assert(typeof getRedoRequestById === "function", "getRedoRequestById exported");

const redoStack = redoRoutes.stack || [];
const redoPaths = [];
for (const layer of redoStack) {
  if (!layer.route) continue;
  const methods = Object.keys(layer.route.methods)
    .filter((m) => layer.route.methods[m])
    .map((m) => m.toUpperCase());
  for (const method of methods) {
    redoPaths.push(`${method} ${layer.route.path}`);
  }
}

const required = [
  "GET /config",
  "POST /",
  "GET /",
  "GET /:id",
  "POST /:id/approve",
  "POST /:id/reject",
  "POST /:id/complete",
];

for (const need of required) {
  assert(redoPaths.includes(need), `redoRoutes has ${need}`);
}

const preciousStack = preciousRoutes.stack || [];
const hasRedoMount = preciousStack.some((layer) => {
  const re = String(layer.regexp || "");
  return re.includes("redo") || layer?.regexp?.toString?.().includes("redo");
});
assert(hasRedoMount, "preciousRoutes mounts /redo");

// Ensure we did not register under a dead invoiceRoutes file
let deadInvoice = false;
try {
  await import("../routes/invoiceRoutes.js");
  deadInvoice = true;
} catch {
  deadInvoice = false;
}
assert(!deadInvoice, "no live dependency on dead invoiceRoutes.js");

console.log("\n[test] redo routes mounted live — surface:");
for (const p of required) console.log(`  ${p}`);
console.log("\n[test] redoRoutes mounted passed.\n");
