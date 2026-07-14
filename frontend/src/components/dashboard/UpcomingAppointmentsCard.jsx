function formatAppointmentTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  if (status === "in_progress") return "In progress";
  if (status === "no_show") return "No show";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function UpcomingAppointmentsCard({
  appointments = [],
  title = "Upcoming appointments",
  subtitle = "Next scheduled visits",
}) {
  return (
    <article className="dashboard-side-card">
      <header className="dashboard-side-card__header">
        <h2 className="dashboard-side-card__title">{title}</h2>
        <p className="dashboard-side-card__subtitle">{subtitle}</p>
      </header>

      {appointments.length === 0 ? (
        <p className="dashboard-side-card__empty">No upcoming appointments.</p>
      ) : (
        <div className="dashboard-side-card__body">
          <ul className="dashboard-appointment-list">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="dashboard-appointment-list__item">
                <div className="dashboard-appointment-list__main">
                  <strong>{appointment.customer_name}</strong>
                  <span>{appointment.service_label}</span>
                </div>
                <div className="dashboard-appointment-list__meta">
                  <span>{formatAppointmentTime(appointment.start_time)}</span>
                  <span className="dashboard-appointment-list__staff">
                    {appointment.staff_name}
                  </span>
                </div>
                <span
                  className={`dashboard-appointment-list__status dashboard-appointment-list__status--${appointment.status}`}
                >
                  {statusLabel(appointment.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
