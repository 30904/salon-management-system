/**
 * Invite delivery hook — Precious replaces this with Meta WhatsApp Cloud API.
 * Arnav-owned user flows call sendUserInviteMessage() only; do not edit user routes.
 */
export async function sendUserInviteMessage(payload) {
  const record = {
    channel: "whatsapp",
    status: "stub_queued",
    recipient_phone: payload.phone,
    template: payload.template || "user_invite",
    message_preview: payload.message,
    queued_at: new Date().toISOString(),
    metadata: {
      user_id: payload.userId,
      role_name: payload.roleName,
      login_url: payload.loginUrl,
    },
  };

  console.log("[invite-stub] User invite queued for WhatsApp delivery", {
    phone: record.recipient_phone,
    user_id: record.metadata.user_id,
    status: record.status,
  });

  return record;
}

export default sendUserInviteMessage;
