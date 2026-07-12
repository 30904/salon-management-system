import {
  createProduct,
  deactivateProduct,
  getProductById,
  listLowStockProducts,
  listProducts,
  updateProduct,
} from "../services/productMasterService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listProductsHandler(req, res) {
  const products = await listProducts({
    isActive: req.query.is_active,
    search: req.query.search,
    lowStock: req.query.low_stock,
  });

  return sendSuccess(res, {
    data: products.map((product) => product.toSafeObject()),
    message: "Products fetched",
  });
}

export async function listLowStockProductsHandler(_req, res) {
  const products = await listLowStockProducts();

  return sendSuccess(res, {
    data: products.map((product) => product.toSafeObject()),
    message: "Low-stock products fetched",
  });
}

export async function getProductHandler(req, res) {
  const product = await getProductById(req.params.id);

  return sendSuccess(res, {
    data: product.toSafeObject(),
    message: "Product fetched",
  });
}

export async function createProductHandler(req, res) {
  const product = await createProduct(req.body);

  return sendSuccess(res, {
    status: 201,
    data: product.toSafeObject(),
    message: "Product created",
  });
}

export async function updateProductHandler(req, res) {
  const product = await updateProduct(req.params.id, req.body);

  return sendSuccess(res, {
    data: product.toSafeObject(),
    message: "Product updated",
  });
}

export async function deactivateProductHandler(req, res) {
  const product = await deactivateProduct(req.params.id);

  return sendSuccess(res, {
    data: product.toSafeObject(),
    message: "Product deactivated",
  });
}
