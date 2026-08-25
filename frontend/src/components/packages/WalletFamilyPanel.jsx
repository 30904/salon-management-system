import { useState } from "react";
import CustomerSearchOrCreate from "../customers/CustomerSearchOrCreate.jsx";
import { preciousApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

const MAX_WALLET_FAMILY_MEMBERS = 6;

function memberId(member) {
  return String(member?.id || member?._id || "");
}

export default function WalletFamilyPanel({
  customerPackageId,
  buyerCustomerId = null,
  initialMembers = [],
  onMembersChange,
  compact = false,
}) {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("billing", "edit");

  const [members, setMembers] = useState(initialMembers);
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);

  const atMax = members.length >= MAX_WALLET_FAMILY_MEMBERS;

  function syncMembers(nextMembers) {
    setMembers(nextMembers);
    onMembersChange?.(nextMembers);
  }

  async function handleAddMember(customer) {
    if (!customer || !customerPackageId) return;

    const id = memberId(customer);
    if (!id) {
      setError("Selected customer has no id.");
      return;
    }

    if (buyerCustomerId && String(buyerCustomerId) === id) {
      setError("The wallet buyer cannot be added as a family member.");
      return;
    }

    if (members.some((m) => memberId(m) === id)) {
      setError("Customer is already linked to this wallet.");
      return;
    }

    if (atMax) {
      setError(`Maximum ${MAX_WALLET_FAMILY_MEMBERS} family members allowed.`);
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const res = await preciousApi.addWalletFamilyMember(customerPackageId, id);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to add family member");
      }

      const nextMember = {
        id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
      };
      const nextMembers = [...members, nextMember];
      syncMembers(nextMembers);
      setPendingCustomer(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to add family member");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(customerId) {
    if (!customerPackageId || !customerId) return;

    setRemovingId(String(customerId));
    setError(null);

    try {
      const res = await preciousApi.removeWalletFamilyMember(customerPackageId, customerId);
      if (!res?.success) {
        throw new Error(res?.message || "Failed to remove family member");
      }

      syncMembers(members.filter((m) => memberId(m) !== String(customerId)));
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to remove family member");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div
      className="status-card"
      style={{
        background: compact ? "#f8fafc" : "var(--s21-surface, #ffffff)",
        borderRadius: "14px",
        border: "1px solid #e2e8f0",
        padding: compact ? "1rem" : "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: compact ? "1rem" : "1.05rem", color: "#0f172a", fontWeight: 600 }}>
            Family Members
          </h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "#64748b" }}>
            Link up to {MAX_WALLET_FAMILY_MEMBERS} family members who can redeem this wallet at POS.
          </p>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.25rem 0.65rem",
            borderRadius: "999px",
            background: atMax ? "#fef3c7" : "#ecfdf5",
            color: atMax ? "#92400e" : "#065f46",
          }}
        >
          {members.length} / {MAX_WALLET_FAMILY_MEMBERS}
        </span>
      </div>

      {members.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 1rem",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {members.map((member) => (
            <li
              key={memberId(member)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 0.85rem",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
              }}
            >
              <div>
                <strong style={{ color: "#0f172a", fontSize: "0.9rem" }}>{member.name}</strong>
                {member.phone ? (
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{member.phone}</div>
                ) : null}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="user-secondary-btn"
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                  disabled={removingId === memberId(member)}
                  onClick={() => handleRemoveMember(memberId(member))}
                >
                  {removingId === memberId(member) ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8", fontStyle: "italic" }}>
          No family members linked yet.
        </p>
      )}

      {canEdit && !atMax ? (
        <div style={{ marginBottom: "0.5rem" }}>
          <CustomerSearchOrCreate
            value={pendingCustomer}
            onChange={(customer) => {
              setPendingCustomer(customer);
              if (customer) {
                handleAddMember(customer);
              }
            }}
            label="Add family member"
            required={false}
            touchLarge={false}
          />
          {isAdding ? (
            <p className="customer-search__hint" style={{ marginTop: "0.35rem" }}>
              Linking family member…
            </p>
          ) : null}
        </div>
      ) : null}

      {!canEdit ? (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
          Billing edit permission required to manage family members.
        </p>
      ) : null}

      {atMax && canEdit ? (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#92400e" }}>
          Maximum family members reached. Remove someone to add another.
        </p>
      ) : null}

      {error ? (
        <div className="status-error" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
