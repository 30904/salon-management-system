/**
 * Local WhatsApp Cloud API diagnostic (does not print the access token).
 * Usage: node scripts/testWhatsAppSend.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(envPath);
const token = env.WHATSAPP_ACCESS_TOKEN || "";
const phoneNumberId = String(env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
const wabaId = String(env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
const templateName = env.WHATSAPP_TEMPLATE_NAME || "_salon_offer_image";
const templateLang = env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
const to = process.argv[2] || "919321796586";

function mask(s) {
  if (!s) return "(empty)";
  if (s.length < 12) return "(too short)";
  return `${s.slice(0, 6)}...${s.slice(-4)} (len=${s.length})`;
}

async function graph(method, urlPath, body) {
  const url = `https://graph.facebook.com/v21.0/${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

console.log("--- WhatsApp diagnostic ---");
console.log("token:", mask(token));
console.log("phone_number_id:", phoneNumberId || "(empty)");
console.log("waba_id:", wabaId || "(empty)");
console.log("template:", templateName, templateLang);
console.log("to:", to);
console.log("");

if (!token || !phoneNumberId) {
  console.error("Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in backend/.env");
  process.exit(1);
}

// 1) Can token read this phone number?
console.log("1) GET phone number...");
const phone = await graph(
  "GET",
  `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,id`
);
console.log(JSON.stringify(phone, null, 2));
console.log("");

// 2) List WABA phone numbers (if waba id set)
if (wabaId) {
  console.log("2) GET waba phone_numbers...");
  const list = await graph("GET", `${wabaId}/phone_numbers`);
  console.log(JSON.stringify(list, null, 2));
  console.log("");
}

// 3) Send hello_world (simplest template)
console.log("3) POST hello_world template...");
const hello = await graph("POST", `${phoneNumberId}/messages`, {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: "hello_world",
    language: { code: "en_US" },
  },
});
console.log(JSON.stringify(hello, null, 2));
console.log("");

// 4) If hello works, try offer template without image first? (will fail if image required)
// Skip — offer needs header image. Only run if media id passed as argv3
console.log("4) GET message templates on WABA...");
if (wabaId) {
  const templates = await graph(
    "GET",
    `${wabaId}/message_templates?fields=name,language,status,category&limit=50`
  );
  console.log(JSON.stringify(templates, null, 2));
  console.log("");
}

const otherWaba = "2120182218876484";
if (wabaId !== otherWaba) {
  console.log(`4b) GET message templates on other WABA ${otherWaba}...`);
  const templates2 = await graph(
    "GET",
    `${otherWaba}/message_templates?fields=name,language,status,category&limit=50`
  );
  console.log(JSON.stringify(templates2, null, 2));
  console.log("");
}

const mediaId = process.argv[3];
if (mediaId) {
  const cleanName = templateName.replace(/^["']|["']$/g, "");
  for (const lang of [templateLang, "en", "en_US"]) {
    console.log(`5) POST ${cleanName} lang=${lang} with media...`);
    const offer = await graph("POST", `${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cleanName,
        language: { code: lang },
        components: [
          {
            type: "header",
            parameters: [{ type: "image", image: { id: mediaId } }],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: "Test User" },
              { type: "text", text: "Test offer from S21" },
            ],
          },
        ],
      },
    });
    console.log(JSON.stringify(offer, null, 2));
    console.log("");
    if (offer.status >= 200 && offer.status < 300) break;
  }
}
