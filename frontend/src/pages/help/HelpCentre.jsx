import { useEffect, useMemo, useState } from "react";
import "./HelpCentre.css";

const SECTIONS = [
  {
    id: "overview",
    label: "Platform overview",
    icon: "overview",
  },
  {
    id: "getting-started",
    label: "Getting started",
    icon: "flag",
  },
  {
    id: "core-concepts",
    label: "Core concepts",
    icon: "book",
  },
  {
    id: "resources",
    label: "Support & resources",
    icon: "globe",
  },
];

const OVERVIEW_CARDS = [
  {
    title: "Dashboard",
    description:
      "Track year-to-date, month-to-date, and today's sales, plus booking trends and KPIs in one place.",
  },
  {
    title: "Bookings",
    description:
      "Create and manage appointments, assign stylists, and move bookings through their status flow.",
  },
  {
    title: "Billing & inventory",
    description:
      "Invoice services and retail products together, with stock deduction and commission tracking.",
  },
  {
    title: "Staff workspace",
    description:
      "Stylists can review their calendar, earnings, and attendance from a focused staff view.",
  },
];

const GETTING_STARTED_STEPS = [
  {
    number: "01",
    title: "Set up masters",
    description:
      "Add services, products, tax rates, packages, and shift rules under Settings before going live.",
  },
  {
    number: "02",
    title: "Add staff & users",
    description:
      "Create staff profiles, map specializations, and invite users with the right role permissions.",
  },
  {
    number: "03",
    title: "Start booking",
    description:
      "Create front-desk appointments, check stylist availability, and keep the day board up to date.",
  },
];

const CORE_CONCEPTS = [
  {
    title: "Bookings",
    description:
      "Internal appointments move from scheduled to checked in, completed, cancelled, or no-show.",
  },
  {
    title: "Sales overview",
    description:
      "Hero metrics roll up invoiced service sales into year, month, and today totals for owners.",
  },
  {
    title: "Commission",
    description:
      "Completed service lines feed staff commission and monthly earnings summaries.",
  },
  {
    title: "Low stock alerts",
    description:
      "Inventory items below reorder level surface in Needs attention so stock can be topped up early.",
  },
  {
    title: "Attendance",
    description:
      "Punch-in and punch-out records feed payroll calculations and staff availability.",
  },
  {
    title: "Packages",
    description:
      "Prepaid bundles and memberships can be sold and redeemed against booked services.",
  },
];

function SectionIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };

  if (name === "flag") {
    return (
      <svg {...common}>
        <path
          d="M4 21V4h9l1 2h6v10h-7l-1-2H6v7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg {...common}>
        <path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="6" cy="8" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="8" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 8h8M7.5 9.5 11 14.5M16.5 9.5 13 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RoadmapIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3v4M16 3v4M3 11h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 15h2M12 15h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HelpCentre() {
  const [activeSection, setActiveSection] = useState("overview");

  const sectionIds = useMemo(() => SECTIONS.map((section) => section.id), []);

  useEffect(() => {
    const observers = [];

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-30% 0px -55% 0px", threshold: 0.1 }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [sectionIds]);

  function scrollToSection(id) {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  return (
    <div className="page help-centre-page">
      <div className="help-centre">
        <aside className="help-centre__nav" aria-label="Help centre sections">
          <div className="help-centre__brand">
            <span className="help-centre__logo">S21</span>
            <div>
              <p className="help-centre__brand-title">Help Centre</p>
              <p className="help-centre__brand-subtitle">Internal documentation</p>
            </div>
          </div>

          <nav className="help-centre__nav-list">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`help-centre__nav-link ${
                  activeSection === section.id ? "active" : ""
                }`}
                onClick={() => scrollToSection(section.id)}
              >
                <SectionIcon name={section.icon} />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="help-centre__content">
          <section id="overview" className="help-centre__section">
            <header className="help-centre__section-header">
              <h1>Platform overview</h1>
              <div className="help-centre__section-rule" aria-hidden="true" />
            </header>
            <p className="help-centre__lead">
              S21 Management keeps salon operations in one place — sales visibility,
              bookings, staff tools, inventory alerts, and settings masters.
            </p>
            <div className="help-centre__feature-grid">
              {OVERVIEW_CARDS.map((card) => (
                <article key={card.title} className="help-centre__feature-card">
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="getting-started" className="help-centre__section">
            <header className="help-centre__section-header">
              <h1>Getting started</h1>
              <div className="help-centre__section-rule" aria-hidden="true" />
            </header>
            <div className="help-centre__steps">
              {GETTING_STARTED_STEPS.map((step) => (
                <article key={step.number} className="help-centre__step-card">
                  <span className="help-centre__step-number" aria-hidden="true">
                    {step.number}
                  </span>
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="core-concepts" className="help-centre__section">
            <header className="help-centre__section-header">
              <h1>Core concepts</h1>
              <div className="help-centre__section-rule" aria-hidden="true" />
            </header>
            <div className="help-centre__concept-grid">
              {CORE_CONCEPTS.map((concept) => (
                <article key={concept.title} className="help-centre__concept-card">
                  <h2>{concept.title}</h2>
                  <p>{concept.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="resources" className="help-centre__section">
            <header className="help-centre__section-header">
              <h1>Support & resources</h1>
              <div className="help-centre__section-rule" aria-hidden="true" />
            </header>
            <div className="help-centre__resource-card">
              <div className="help-centre__resource-icon">
                <RoadmapIcon />
              </div>
              <div>
                <h2>Roadmap & updates</h2>
                <p>
                  Upcoming work includes the front-desk bookings module, POS billing,
                  package redemption, and richer CRM automation — delivered module by
                  module against the implementation tracker.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
