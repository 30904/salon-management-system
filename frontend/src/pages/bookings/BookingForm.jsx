import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CustomerSearchOrCreate from "../../components/customers/CustomerSearchOrCreate.jsx";
import { arnavApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { usePermission } from "../../hooks/usePermission.js";

function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatSlotTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!remainder) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainder} min`;
}

function specializationTagsForService(service) {
  const category = String(service.category?.name || "").toLowerCase();
  const name = String(service.name || "").toLowerCase();

  if (category.includes("hair") || name.includes("hair") || name.includes("cut")) {
    return ["hair"];
  }

  if (
    category.includes("color") ||
    name.includes("color") ||
    name.includes("highlight")
  ) {
    return ["hair", "color"];
  }

  if (
    category.includes("spa") ||
    category.includes("skin") ||
    name.includes("facial") ||
    name.includes("spa")
  ) {
    return ["spa", "skin"];
  }

  if (category.includes("massage") || name.includes("massage")) {
    return ["massage", "spa"];
  }

  if (category.includes("bridal") || name.includes("bridal")) {
    return ["bridal", "hair"];
  }

  if (category.includes("nail") || name.includes("nail")) {
    return ["nail"];
  }

  return [];
}

function stylistMatchesServices(stylist, selectedServices) {
  if (!selectedServices.length) {
    return true;
  }

  const specs = (stylist.specialization || []).map((value) =>
    String(value).toLowerCase()
  );

  return selectedServices.every((service) => {
    const tags = specializationTagsForService(service);

    if (!tags.length) {
      return true;
    }

    return tags.some((tag) => specs.includes(tag));
  });
}

function stylistLabel(stylist) {
  return stylist.user?.name || stylist.designation || "Stylist";
}

export default function BookingForm() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const canCreate = hasPermission("bookings", "create");

  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [stylistId, setStylistId] = useState("");
  const [bookingDate, setBookingDate] = useState(toDateInputValue());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [notes, setNotes] = useState("");
  const [walkIn, setWalkIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const selectedServices = useMemo(
    () =>
      services.filter((service) =>
        selectedServiceIds.includes(String(service.id))
      ),
    [services, selectedServiceIds]
  );

  const totalDuration = useMemo(
    () =>
      selectedServices.reduce(
        (total, service) => total + Number(service.duration_minutes || 0),
        0
      ),
    [selectedServices]
  );

  const filteredStylists = useMemo(
    () => stylists.filter((stylist) => stylistMatchesServices(stylist, selectedServices)),
    [stylists, selectedServices]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMasters() {
      setLoading(true);
      setError(null);

      try {
        const [servicesResponse, stylistsResponse] = await Promise.all([
          arnavApi.listServices({ is_active: "true" }),
          fetchStaffProfiles({ is_active: "true" }),
        ]);

        if (!servicesResponse.success) {
          throw new Error(servicesResponse.message || "Failed to load services");
        }

        if (!stylistsResponse.success) {
          throw new Error(
            stylistsResponse.message || "Failed to load stylists"
          );
        }

        if (!cancelled) {
          setServices(servicesResponse.data || []);
          setStylists(stylistsResponse.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMasters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      stylistId &&
      !filteredStylists.some((stylist) => String(stylist.id) === stylistId)
    ) {
      setStylistId("");
      setSelectedSlot(null);
    }
  }, [filteredStylists, stylistId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (
        walkIn ||
        !stylistId ||
        !bookingDate ||
        selectedServiceIds.length === 0 ||
        totalDuration <= 0
      ) {
        setSlots([]);
        setSelectedSlot(null);
        return;
      }

      setSlotsLoading(true);
      setError(null);

      try {
        const response = await arnavApi.getBookingAvailability({
          stylist_id: stylistId,
          date: bookingDate,
          duration_minutes: totalDuration,
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to load availability");
        }

        if (!cancelled) {
          const nextSlots = response.data?.slots || [];
          setSlots(nextSlots);
          setSelectedSlot((current) => {
            if (
              current &&
              nextSlots.some(
                (slot) =>
                  new Date(slot.start_time).getTime() ===
                  new Date(current.start_time).getTime()
              )
            ) {
              return current;
            }

            return null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([]);
          setSelectedSlot(null);
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    }

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [
    walkIn,
    stylistId,
    bookingDate,
    selectedServiceIds,
    totalDuration,
  ]);

  function toggleService(serviceId) {
    const id = String(serviceId);

    setSelectedServiceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
    setSelectedSlot(null);
    setSuccess(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!canCreate) {
        throw new Error("You do not have permission to create bookings");
      }

      if (!customer?.id) {
        throw new Error("Select or create a customer");
      }

      if (selectedServiceIds.length === 0) {
        throw new Error("Select at least one service");
      }

      if (!stylistId) {
        throw new Error("Select a stylist");
      }

      if (!walkIn && !selectedSlot?.start_time) {
        throw new Error("Select an available time slot");
      }

      const payload = {
        customer_id: customer.id,
        stylist_id: stylistId,
        service_ids: selectedServiceIds,
        notes: notes.trim() || null,
        walk_in: walkIn,
      };

      if (!walkIn) {
        payload.start_time = selectedSlot.start_time;
      }

      const response = await arnavApi.createBooking(payload);

      if (!response.success) {
        throw new Error(response.message || "Failed to create booking");
      }

      setSuccess("Booking created");
      navigate("/bookings", {
        replace: true,
        state: { success: "Booking created" },
      });
    } catch (err) {
      const apiData = err.response?.data;
      const suggestion = apiData?.data?.suggestion;

      if (suggestion?.start_time) {
        setError(
          `${apiData?.message || err.message}. Next slot: ${formatSlotTime(
            suggestion.start_time
          )}`
        );
      } else {
        setError(apiData?.message || err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page booking-form-page">
        <p>Loading booking form…</p>
      </div>
    );
  }

  return (
    <div className="page booking-form-page">
      <header className="page-header user-list-header">
        <div>
          <p className="app-eyebrow">Bookings</p>
          <h1>New booking</h1>
          <p className="page-description">
            Front-desk appointment booking with customer lookup, services,
            stylist match, and slot selection.
          </p>
        </div>

        <Link to="/bookings" className="user-secondary-btn">
          Back to queue
        </Link>
      </header>

      {success && <p className="user-success-text">{success}</p>}
      {error && <p className="status-error">{error}</p>}

      <form className="status-card booking-form-card booking-form-card--touch" onSubmit={handleSubmit}>
        <CustomerSearchOrCreate
          value={customer}
          onChange={setCustomer}
          required
          touchLarge
        />

        <section className="booking-form-section">
          <div className="booking-form-section__header">
            <h2>Services</h2>
            {selectedServices.length > 0 && (
              <span className="booking-form-meta">
                {selectedServices.length} selected · {formatDuration(totalDuration)}
              </span>
            )}
          </div>

          <div className="booking-service-grid">
            {services.map((service) => {
              const isSelected = selectedServiceIds.includes(String(service.id));

              return (
                <button
                  key={service.id}
                  type="button"
                  className={`booking-service-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleService(service.id)}
                >
                  <span className="booking-service-chip__name">{service.name}</span>
                  <span className="booking-service-chip__meta">
                    {service.category?.name || "Service"} ·{" "}
                    {formatDuration(service.duration_minutes)} · ₹
                    {Number(service.price).toLocaleString("en-IN")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <label className="booking-form-field">
          Stylist
          <select
            value={stylistId}
            onChange={(event) => {
              setStylistId(event.target.value);
              setSelectedSlot(null);
            }}
            required
            disabled={selectedServiceIds.length === 0}
          >
            <option value="">
              {selectedServiceIds.length === 0
                ? "Select services first"
                : "Choose stylist"}
            </option>
            {filteredStylists.map((stylist) => (
              <option key={stylist.id} value={String(stylist.id)}>
                {stylistLabel(stylist)}
                {stylist.specialization?.length
                  ? ` (${stylist.specialization.join(", ")})`
                  : ""}
              </option>
            ))}
          </select>
          {selectedServiceIds.length > 0 && filteredStylists.length === 0 && (
            <p className="booking-form-hint booking-form-hint--error">
              No stylists match the selected services.
            </p>
          )}
        </label>

        <label className="booking-form-toggle">
          <input
            type="checkbox"
            checked={walkIn}
            onChange={(event) => {
              setWalkIn(event.target.checked);
              setSelectedSlot(null);
            }}
          />
          <span>Walk-in (start now)</span>
        </label>

        {!walkIn && (
          <>
            <label className="booking-form-field">
              Date
              <input
                type="date"
                value={bookingDate}
                onChange={(event) => {
                  setBookingDate(event.target.value);
                  setSelectedSlot(null);
                }}
                required
              />
            </label>

            <section className="booking-form-section">
              <div className="booking-form-section__header">
                <h2>Available slots</h2>
                {totalDuration > 0 && (
                  <span className="booking-form-meta">
                    {formatDuration(totalDuration)} block
                  </span>
                )}
              </div>

              {!stylistId || selectedServiceIds.length === 0 ? (
                <p className="booking-form-hint">
                  Select services and stylist to load open slots.
                </p>
              ) : null}

              {slotsLoading && (
                <p className="booking-form-hint">Loading availability…</p>
              )}

              {!slotsLoading &&
                stylistId &&
                selectedServiceIds.length > 0 &&
                slots.length === 0 && (
                  <p className="booking-form-hint">
                    No open slots for this day. Try another date or stylist.
                  </p>
                )}

              {!slotsLoading && slots.length > 0 && (
                <div className="booking-slot-grid">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.start_time &&
                      new Date(selectedSlot.start_time).getTime() ===
                        new Date(slot.start_time).getTime();

                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        className={`booking-slot-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {formatSlotTime(slot.start_time)}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <label className="booking-form-field">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Preferences, patch test done, reference photos, etc."
          />
        </label>

        <div className="user-form-actions">
          <button
            type="submit"
            className="user-primary-btn"
            disabled={saving || !canCreate}
          >
            {saving ? "Creating…" : walkIn ? "Create walk-in" : "Create booking"}
          </button>
          <Link to="/bookings" className="user-secondary-btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
