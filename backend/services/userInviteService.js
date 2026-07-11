import { sendUserInviteMessage } from "./invite/inviteDispatcher.js";

const DEFAULT_LOGIN_PATH = "/login";

export function getLoginUrl() {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  const loginPath = process.env.INVITE_LOGIN_PATH || DEFAULT_LOGIN_PATH;
  return `${clientUrl}${loginPath.startsWith("/") ? loginPath : `/${loginPath}`}`;
}

export function buildUserInviteMessage({ name, phone, roleName, tempPassword, loginUrl }) {
  return (
    `Welcome to S21 Salon System, ${name}!\n` +
    `Your login phone: ${phone}\n` +
    `Temporary password: ${tempPassword}\n` +
    `Role: ${roleName || "Staff"}\n` +
    `Sign in: ${loginUrl}`
  );
}

export async function sendUserInvite({
  user,
  tempPassword,
  createdBy = null,
  channel = "whatsapp",
}) {
  const loginUrl = getLoginUrl();
  const phone = user.phone;
  const roleName = user.role_id?.name || null;

  const message = buildUserInviteMessage({
    name: user.name,
    phone,
    roleName,
    tempPassword,
    loginUrl,
  });

  const payload = {
    userId: user._id?.toString() || user.id,
    phone,
    name: user.name,
    roleName,
    tempPassword,
    loginUrl,
    channel,
    template: "user_invite",
    message,
    created_by: createdBy?._id?.toString() || createdBy || null,
  };

  const delivery = await sendUserInviteMessage(payload);

  return {
    channel,
    status: delivery.status,
    delivery,
    loginUrl,
    message_preview: message,
    note: "WhatsApp sender is a stub — Precious wires inviteDispatcher.js",
  };
}

export default sendUserInvite;
