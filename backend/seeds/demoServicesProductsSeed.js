import ServiceCategory from "../models/ServiceCategory.js";
import ServiceMaster from "../models/ServiceMaster.js";
import ProductMaster from "../models/ProductMaster.js";

export const DEMO_SERVICE_CATEGORIES = [
  { name: "Hair Services" },
  { name: "Skin & Facial" },
  { name: "Spa & Massage" },
  { name: "Nails" },
];

export const DEMO_SERVICES = [
  { category: "Hair Services", name: "Men's Haircut", duration_minutes: 30, price: 300 },
  { category: "Hair Services", name: "Women's Haircut", duration_minutes: 45, price: 500 },
  { category: "Hair Services", name: "Hair Color (Global)", duration_minutes: 90, price: 2500 },
  { category: "Hair Services", name: "Blow Dry & Styling", duration_minutes: 30, price: 400 },
  { category: "Skin & Facial", name: "Basic Cleanup", duration_minutes: 45, price: 800 },
  { category: "Skin & Facial", name: "Premium Facial", duration_minutes: 60, price: 1500 },
  { category: "Skin & Facial", name: "De-Tan Pack", duration_minutes: 40, price: 700 },
  { category: "Spa & Massage", name: "Head Massage", duration_minutes: 30, price: 500 },
  { category: "Spa & Massage", name: "Full Body Massage", duration_minutes: 60, price: 2000 },
  { category: "Spa & Massage", name: "Foot Reflexology", duration_minutes: 45, price: 900 },
  { category: "Nails", name: "Manicure", duration_minutes: 35, price: 450 },
  { category: "Nails", name: "Pedicure", duration_minutes: 45, price: 550 },
];

export const DEMO_PRODUCTS = [
  {
    name: "Professional Shampoo 250ml",
    sku: "PRD-SH-250",
    unit: "bottle",
    purchase_price: 150,
    sale_price: 299,
    current_stock: 24,
    reorder_level: 6,
  },
  {
    name: "Hydrating Conditioner 250ml",
    sku: "PRD-CD-250",
    unit: "bottle",
    purchase_price: 160,
    sale_price: 319,
    current_stock: 18,
    reorder_level: 5,
  },
  {
    name: "Hair Serum 100ml",
    sku: "PRD-HS-100",
    unit: "bottle",
    purchase_price: 220,
    sale_price: 449,
    current_stock: 12,
    reorder_level: 4,
  },
  {
    name: "Herbal Face Wash 100ml",
    sku: "PRD-FW-100",
    unit: "tube",
    purchase_price: 90,
    sale_price: 179,
    current_stock: 30,
    reorder_level: 8,
  },
  {
    name: "Nail Polish (Classic Red)",
    sku: "PRD-NP-RED",
    unit: "piece",
    purchase_price: 65,
    sale_price: 149,
    current_stock: 3,
    reorder_level: 10,
  },
  {
    name: "Disposable Towel Pack (50)",
    sku: "PRD-TW-50",
    unit: "pack",
    purchase_price: 180,
    sale_price: 250,
    current_stock: 40,
    reorder_level: 10,
  },
];

async function upsertCategory(name) {
  return ServiceCategory.findOneAndUpdate(
    { name },
    { name, is_active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertService(categoryId, service) {
  return ServiceMaster.findOneAndUpdate(
    { category_id: categoryId, name: service.name },
    {
      category_id: categoryId,
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: service.price,
      commission_slab_override_id: null,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertProduct(product) {
  return ProductMaster.findOneAndUpdate(
    { sku: product.sku },
    {
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      current_stock: product.current_stock,
      reorder_level: product.reorder_level,
      is_active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Sample service categories, services, and retail products for UI dev.
 * Replace with client-confirmed pricing after discovery (tracker Phase 1).
 */
export async function seedDemoServicesAndProducts() {
  const categories = [];
  const categoryByName = new Map();

  for (const categoryDef of DEMO_SERVICE_CATEGORIES) {
    const category = await upsertCategory(categoryDef.name);
    categories.push(category);
    categoryByName.set(category.name, category);
  }

  const services = [];

  for (const serviceDef of DEMO_SERVICES) {
    const category = categoryByName.get(serviceDef.category);

    if (!category) {
      throw new Error(`Missing demo category: ${serviceDef.category}`);
    }

    const service = await upsertService(category._id, serviceDef);
    services.push(service);
  }

  const products = [];

  for (const productDef of DEMO_PRODUCTS) {
    const product = await upsertProduct(productDef);
    products.push(product);
  }

  return {
    categories,
    services,
    products,
    counts: {
      categories: categories.length,
      services: services.length,
      products: products.length,
    },
  };
}

export default seedDemoServicesAndProducts;
