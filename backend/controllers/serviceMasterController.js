import {
  createService,
  createServiceCategory,
  deactivateService,
  deactivateServiceCategory,
  getServiceById,
  getServiceCategoryById,
  listServiceCategories,
  listServices,
  updateService,
  updateServiceCategory,
} from "../services/serviceMasterService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listServiceCategoriesHandler(req, res) {
  const categories = await listServiceCategories({
    isActive: req.query.is_active,
    search: req.query.search,
  });

  return sendSuccess(res, {
    data: categories.map((category) => category.toSafeObject()),
    message: "Service categories fetched",
  });
}

export async function getServiceCategoryHandler(req, res) {
  const category = await getServiceCategoryById(req.params.id);

  return sendSuccess(res, {
    data: category.toSafeObject(),
    message: "Service category fetched",
  });
}

export async function createServiceCategoryHandler(req, res) {
  const category = await createServiceCategory(req.body);

  return sendSuccess(res, {
    status: 201,
    data: category.toSafeObject(),
    message: "Service category created",
  });
}

export async function updateServiceCategoryHandler(req, res) {
  const category = await updateServiceCategory(req.params.id, req.body);

  return sendSuccess(res, {
    data: category.toSafeObject(),
    message: "Service category updated",
  });
}

export async function deactivateServiceCategoryHandler(req, res) {
  const category = await deactivateServiceCategory(req.params.id);

  return sendSuccess(res, {
    data: category.toSafeObject(),
    message: "Service category deactivated",
  });
}

export async function listServicesHandler(req, res) {
  const services = await listServices({
    categoryId: req.query.category_id,
    isActive: req.query.is_active,
    search: req.query.search,
  });

  return sendSuccess(res, {
    data: services.map((service) => service.toSafeObject()),
    message: "Services fetched",
  });
}

export async function getServiceHandler(req, res) {
  const service = await getServiceById(req.params.id);

  return sendSuccess(res, {
    data: service.toSafeObject(),
    message: "Service fetched",
  });
}

export async function createServiceHandler(req, res) {
  const service = await createService(req.body);

  return sendSuccess(res, {
    status: 201,
    data: service.toSafeObject(),
    message: "Service created",
  });
}

export async function updateServiceHandler(req, res) {
  const service = await updateService(req.params.id, req.body);

  return sendSuccess(res, {
    data: service.toSafeObject(),
    message: "Service updated",
  });
}

export async function deactivateServiceHandler(req, res) {
  const service = await deactivateService(req.params.id);

  return sendSuccess(res, {
    data: service.toSafeObject(),
    message: "Service deactivated",
  });
}
