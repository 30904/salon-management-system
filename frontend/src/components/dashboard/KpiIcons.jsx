function IconBase({ children }) {
  return (
    <svg
      className="kpi-card__icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BookingsIcon() {
  return (
    <IconBase>
      <path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 14h.01M12 14h.01M16 14h.01"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function UpcomingIcon() {
  return (
    <IconBase>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function CompletedIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="m8.5 12.2 2.2 2.2L15.8 9.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function CheckedInIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.25" fill="currentColor" />
    </IconBase>
  );
}

export function InventoryIcon() {
  return (
    <IconBase>
      <path
        d="M12 4.5 3.5 9.5 12 14.5l8.5-5L12 4.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 11.5V16l6 3.5L18 16v-4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.5V22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function CustomersIcon() {
  return (
    <IconBase>
      <path
        d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8" r="3.25" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20v-1a3 3 0 0 0-2.2-2.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15.5 4.1a3.25 3.25 0 0 1 0 6.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function StaffIcon() {
  return (
    <IconBase>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5.5 20v-1.2A4.8 4.8 0 0 1 10.3 14h3.4a4.8 4.8 0 0 1 4.8 4.8V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18.5 8.5h3M20 7v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function UsersIcon() {
  return (
    <IconBase>
      <path
        d="M17 20v-1a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 7 19v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.5" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 11.5a2.75 2.75 0 0 1 0-5M19 11.5a2.75 2.75 0 0 0 0-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function EarningsIcon() {
  return (
    <IconBase>
      <path
        d="M12 3v18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15.5 7.5c0-1.4-1.6-2.5-3.5-2.5S8.5 6.1 8.5 7.5 10.1 10 12 10s3.5 1.1 3.5 2.5S13.9 15 12 15s-3.5 1.1-3.5 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function SalesIcon() {
  return (
    <IconBase>
      <path
        d="M4 19h16M6 17V9M10 17V6M14 17v-4M18 17V11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function SalaryIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 10h.01M17 14h.01"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function DefaultKpiIcon() {
  return (
    <IconBase>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 12h6M12 9v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

const KPI_ICON_MAP = {
  bookings: BookingsIcon,
  upcoming: UpcomingIcon,
  completed: CompletedIcon,
  "checked-in": CheckedInIcon,
  inventory: InventoryIcon,
  customers: CustomersIcon,
  staff: StaffIcon,
  users: UsersIcon,
  earnings: EarningsIcon,
  sales: SalesIcon,
  salary: SalaryIcon,
};

export function KpiIcon({ name }) {
  const Icon = KPI_ICON_MAP[name] || DefaultKpiIcon;
  return <Icon />;
}
