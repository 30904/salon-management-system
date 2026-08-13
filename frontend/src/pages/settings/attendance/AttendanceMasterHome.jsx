import { Link } from "react-router-dom";
import ShiftList from "./ShiftList.jsx";
import "./AttendanceSettings.css";

export default function AttendanceMasterHome() {
  return (
    <div className="page attendance-settings-page">
      <header className="module-hero-header">
        <div className="module-hero-text">
          <h1>Shift Schedules Master</h1>
          <p>Configure staff shift rosters, start check-in times, and end check-out schedules.</p>
        </div>
        <div className="module-hero-actions">
          <Link to="/settings" className="module-hero-btn">
            Back to settings
          </Link>
        </div>
      </header>

      <ShiftList />
    </div>
  );
}
