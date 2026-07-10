import { sendError } from "../utils/apiResponse.js";

export function notFoundHandler(req, res) {
  return sendError(res, {
    status: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
