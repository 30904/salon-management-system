import crypto from "crypto";

/**
 * Generates a one-time temporary password for new user invites.
 * Row 16 will wire WhatsApp delivery — for now returned to Owner on create.
 */
export function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, chars.length);
    result += chars[index];
  }

  return `Temp@${result}`;
}

export default generateTempPassword;
