import { Navigate, useParams } from "react-router-dom";
import {
  CORE_CONCEPTS,
  GETTING_STARTED_STEPS,
  HELP_SECTIONS,
  OVERVIEW_CARDS,
} from "./helpContent.js";
import "./HelpCentre.css";

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

function OverviewSection() {
  return (
    <section className="help-centre__section">
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
  );
}

function GettingStartedSection() {
  return (
    <section className="help-centre__section">
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
  );
}

function CoreConceptsSection() {
  return (
    <section className="help-centre__section">
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
  );
}

function ResourcesSection() {
  return (
    <section className="help-centre__section">
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
  );
}

const SECTION_VIEWS = {
  overview: OverviewSection,
  "getting-started": GettingStartedSection,
  "core-concepts": CoreConceptsSection,
  resources: ResourcesSection,
};

export default function HelpCentre() {
  const { sectionId } = useParams();
  const validIds = HELP_SECTIONS.map((section) => section.id);

  if (!sectionId || !validIds.includes(sectionId)) {
    return <Navigate to="/help/overview" replace />;
  }

  const SectionView = SECTION_VIEWS[sectionId];

  return (
    <div className="page help-centre-page">
      <SectionView />
    </div>
  );
}
