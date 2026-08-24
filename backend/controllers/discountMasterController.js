import {
  createDiscount,
  deactivateDiscount,
  getDiscountById,
  listDiscounts,
  updateDiscount,
} from "../services/discountMasterService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listDiscountsHandler(req, res) {
  const discounts = await listDiscounts({
    isActive: req.query.is_active,
    search: req.query.search,
    availableNow: req.query.available_now,
  });

  return sendSuccess(res, {
    data: discounts.map((discount) => discount.toSafeObject()),
    message: "Discount types fetched",
  });
}

export async function getDiscountHandler(req, res) {
  const discount = await getDiscountById(req.params.id);

  return sendSuccess(res, {
    data: discount.toSafeObject(),
    message: "Discount type fetched",
  });
}

export async function createDiscountHandler(req, res) {
  const discount = await createDiscount(req.body);

  return sendSuccess(res, {
    status: 201,
    data: discount.toSafeObject(),
    message: "Discount type created",
  });
}

export async function updateDiscountHandler(req, res) {
  const discount = await updateDiscount(req.params.id, req.body);

  return sendSuccess(res, {
    data: discount.toSafeObject(),
    message: "Discount type updated",
  });
}

export async function deactivateDiscountHandler(req, res) {
  const discount = await deactivateDiscount(req.params.id);

  return sendSuccess(res, {
    data: discount.toSafeObject(),
    message: "Discount type deactivated",
  });
}
