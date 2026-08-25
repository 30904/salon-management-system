import {
  createCustomer,
  deleteCustomer,
  findOrCreateCustomer,
  getCustomerById,
  listCustomers,
  searchCustomers,
  updateCustomer,
  getActivePackagesByCustomerId,
} from "../services/customerService.js";
import {
  parseCustomerImportFile,
  importCustomers,
  getImportBatchById,
} from "../services/customerImportService.js";
import {
  getInactiveCustomers,
  DEFAULT_INACTIVE_THRESHOLD_DAYS,
} from "../services/crmAlertService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

export async function listCustomersHandler(req, res) {
  const result = await listCustomers({
    search: req.query.search,
    page: req.query.page,
    pageSize: req.query.pageSize ?? req.query.limit,
  });

  return sendSuccess(res, {
    data: {
      items: result.items.map((customer) => customer.toSafeObject()),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    },
    message: "Customers fetched",
  });
}

export async function searchCustomersHandler(req, res) {
  const customers = await searchCustomers(req.query.q, {
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    data: customers.map((customer) => customer.toSafeObject()),
    message: "Customer search results",
  });
}

export async function getCustomerHandler(req, res) {
  const customer = await getCustomerById(req.params.id);

  return sendSuccess(res, {
    data: customer.toSafeObject(),
    message: "Customer fetched",
  });
}

export async function createCustomerHandler(req, res) {
  const customer = await createCustomer(req.body);

  return sendSuccess(res, {
    status: 201,
    data: customer.toSafeObject(),
    message: "Customer created",
  });
}

export async function updateCustomerHandler(req, res) {
  const customer = await updateCustomer(req.params.id, req.body);

  return sendSuccess(res, {
    data: customer.toSafeObject(),
    message: "Customer updated",
  });
}

export async function deleteCustomerHandler(req, res) {
  const customer = await deleteCustomer(req.params.id);

  return sendSuccess(res, {
    data: { id: customer._id },
    message: "Customer deleted",
  });
}

export async function findOrCreateCustomerHandler(req, res) {
  const result = await findOrCreateCustomer(req.body);

  return sendSuccess(res, {
    status: result.created ? 201 : 200,
    data: {
      customer: result.customer.toSafeObject(),
      created: result.created,
    },
    message: result.created ? "Customer created" : "Customer found",
  });
}

export async function getActiveCustomerPackagesHandler(req, res) {
  const packages = await getActivePackagesByCustomerId(req.params.id);

  return sendSuccess(res, {
    data: packages.map((doc) => doc.toSafeObject()),
    message: "Active customer packages fetched successfully for billing redemption UI",
  });
}

export async function importCustomersHandler(req, res) {
  if (!req.file?.buffer) {
    throw new AppError("Import file is required (field name: file)", 400);
  }

  const parsed = parseCustomerImportFile(req.file.buffer, {
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  const batch = await importCustomers({
    rows: parsed.rows,
    uploadedBy: req.user._id,
    fileName: req.file.originalname || "upload.xlsx",
  });

  return sendSuccess(res, {
    status: 201,
    data: batch.toSafeObject(),
    message: "Customer import completed",
  });
}

export async function getImportBatchHandler(req, res) {
  const batch = await getImportBatchById(req.params.batchId);

  return sendSuccess(res, {
    data: batch.toSafeObject(),
    message: "Customer import batch fetched",
  });
}

export async function getInactiveCustomersHandler(req, res) {
  const raw = req.query.threshold_days;
  const thresholdDays =
    raw === undefined || raw === null || raw === ""
      ? DEFAULT_INACTIVE_THRESHOLD_DAYS
      : Number(raw);

  const result = await getInactiveCustomers({
    thresholdDays,
    search: req.query.search,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });

  return sendSuccess(res, {
    data: {
      threshold_days: result.threshold_days,
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    },
    message: "Inactive customers fetched",
  });
}
