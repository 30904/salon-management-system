import jwt from "jsonwebtoken";

function getAccessSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }
  return secret;
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET || getAccessSecret();
}

export function signAccessToken(payload) {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret());
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret());
}
