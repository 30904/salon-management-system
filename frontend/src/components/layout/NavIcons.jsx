function IconBase({ children }) {
  return (
    <svg
      className="shell-nav-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <IconBase>
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="3"
        width="8"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="10"
        width="8"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
}

function BookingsIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function BillingIcon() {
  return (
    <IconBase>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 9h6M10 12.5h6M10 16h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function CrmIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </IconBase>
  );
}

function AttendanceIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function InventoryIcon() {
  return (
    <IconBase>
      <path
        d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12v9M4 7.5 12 12l8-4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function PayrollIcon() {
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
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 14h2M14 14h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function EmployeesIcon() {
  return (
    <IconBase>
      <path
        d="M12 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 11z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5.5 20v-1.2A4.5 4.5 0 0 1 10 14.5h4a4.5 4.5 0 0 1 4.5 4.5V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 8.5h2.5M19.25 7.25v2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function UsersIcon() {
  return (
    <IconBase>
      <path
        d="M16 19v-1a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 18v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="11" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M18 10.5a2.5 2.5 0 1 0 0-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function ReportsIcon() {
  return (
    <IconBase>
      <path
        d="M5 19V9M10 19V5M15 19v-6M20 19v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function SettingsIcon() {
  return (
    <IconBase>
      <path
        d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function HelpOverviewIcon() {
  return (
    <IconBase>
      <circle cx="6" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 8h8M7.5 9.5 11 14.5M16.5 9.5 13 14.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function HelpFlagIcon() {
  return (
    <IconBase>
      <path
        d="M4 21V4h9l1 2h6v10h-7l-1-2H6v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function HelpBookIcon() {
  return (
    <IconBase>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function HelpGlobeIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

function HelpBackIcon() {
  return (
    <IconBase>
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

function DefaultNavIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </IconBase>
  );
}

const NAV_ICON_MAP = {
  dashboard: DashboardIcon,
  bookings: BookingsIcon,
  billing: BillingIcon,
  crm: CrmIcon,
  attendance: AttendanceIcon,
  inventory: InventoryIcon,
  payroll: PayrollIcon,
  employees: EmployeesIcon,
  users: UsersIcon,
  reports: ReportsIcon,
  settings: SettingsIcon,
  overview: HelpOverviewIcon,
  flag: HelpFlagIcon,
  book: HelpBookIcon,
  globe: HelpGlobeIcon,
  back: HelpBackIcon,
};

export function NavIcon({ name }) {
  const Icon = NAV_ICON_MAP[name] || DefaultNavIcon;
  return <Icon />;
}
