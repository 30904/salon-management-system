import { Link } from "react-router-dom";

export default function AccessDenied({ module, action = "view", fallbackPath = "/dashboard" }) {
  return (
    <div className="page access-denied-page">
      <div className="access-denied-card">
        <p className="app-eyebrow">Access denied</p>
        <h1>You don&apos;t have permission</h1>
        <p className="page-description">
          Your account is signed in, but it doesn&apos;t include{" "}
          <strong>
            {module}.{action}
          </strong>{" "}
          access.
        </p>
        <Link className="page-link" to={fallbackPath}>
          Go to an allowed page
        </Link>
      </div>
    </div>
  );
}
