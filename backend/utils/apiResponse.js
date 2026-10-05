export function buildResponse({ success, data = null, message, pagination }) {
  const body = { success, data, message };
  if (pagination) body.pagination = pagination;
  return body;
}

export function sendSuccess(res, { status = 200, data = null, message = "OK", pagination } = {}) {
  return res.status(status).json(buildResponse({ success: true, data, message, pagination }));
}

export function sendError(res, { status = 500, data = null, message = "Something went wrong" }) {
  return res.status(status).json(buildResponse({ success: false, data, message }));
}
