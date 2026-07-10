import { sendError } from "../utils/apiResponse.js";

function parseError(err) {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return {
      statusCode: 400,
      message: messages.join(", ") || "Validation failed",
      data: null,
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: 400,
      message: "Invalid identifier in request",
      data: null,
    };
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return {
      statusCode: 409,
      message: `Duplicate value for ${field}`,
      data: null,
    };
  }

  if (err.name === "JsonWebTokenError") {
    return { statusCode: 401, message: "Invalid token", data: null };
  }

  if (err.name === "TokenExpiredError") {
    return { statusCode: 401, message: "Token expired", data: null };
  }

  if (err.isOperational) {
    return {
      statusCode: err.statusCode || 500,
      message: err.message,
      data: err.data ?? null,
    };
  }

  return {
    statusCode: 500,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
    data: null,
  };
}

export function errorHandler(err, req, res, _next) {
  const { statusCode, message, data } = parseError(err);

  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  return sendError(res, { status: statusCode, message, data });
}
