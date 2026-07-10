import { Link } from "react-router-dom";

export default function PlaceholderPage({ title, description, module }) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="app-eyebrow">{module}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </header>
      <p className="page-note">Module screen coming in a later tracker row.</p>
      <Link to="/dashboard" className="page-link">
        Back to dashboard
      </Link>
    </div>
  );
}
