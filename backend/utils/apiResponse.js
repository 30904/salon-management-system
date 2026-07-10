export function buildResponse({ success, data = null, message }) {
  return { success, data, message };
}

export function sendSuccess(res, { status = 200, data = null, message = "OK" }) {
  return res.status(status).json(buildResponse({ success: true, data, message }));
}

export function sendError(res, { status = 500, data = null, message = "Something went wrong" }) {
  return res.status(status).json(buildResponse({ success: false, data, message }));
}
