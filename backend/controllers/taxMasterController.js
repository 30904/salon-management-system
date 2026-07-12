import {
  createTax,
  deactivateTax,
  getTaxById,
  listTaxes,
  updateTax,
} from "../services/taxMasterService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listTaxesHandler(req, res) {
  const taxes = await listTaxes({
    isActive: req.query.is_active,
    search: req.query.search,
    appliesTo: req.query.applies_to,
  });

  return sendSuccess(res, {
    data: taxes.map((tax) => tax.toSafeObject()),
    message: "Taxes fetched",
  });
}

export async function getTaxHandler(req, res) {
  const tax = await getTaxById(req.params.id);

  return sendSuccess(res, {
    data: tax.toSafeObject(),
    message: "Tax fetched",
  });
}

export async function createTaxHandler(req, res) {
  const tax = await createTax(req.body);

  return sendSuccess(res, {
    status: 201,
    data: tax.toSafeObject(),
    message: "Tax created",
  });
}

export async function updateTaxHandler(req, res) {
  const tax = await updateTax(req.params.id, req.body);

  return sendSuccess(res, {
    data: tax.toSafeObject(),
    message: "Tax updated",
  });
}

export async function deactivateTaxHandler(req, res) {
  const tax = await deactivateTax(req.params.id);

  return sendSuccess(res, {
    data: tax.toSafeObject(),
    message: "Tax deactivated",
  });
}
