import {
  createCustomer,
  findOrCreateCustomer,
  getCustomerById,
  listCustomers,
  searchCustomers,
  updateCustomer,
  getActivePackagesByCustomerId,
} from "../services/customerService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function listCustomersHandler(req, res) {
  const customers = await listCustomers({
    search: req.query.search,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    data: customers.map((customer) => customer.toSafeObject()),
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
