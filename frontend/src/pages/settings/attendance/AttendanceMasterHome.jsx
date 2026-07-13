import React from "react";
import ShiftList from "./ShiftList.jsx";
import "./AttendanceSettings.css";

export default function AttendanceMasterHome() {
  return (
    <div className="attendance-settings-container">
      {/* Header Banner */}
      <div className="attendance-header-banner">
        <div className="attendance-banner-text">
          <h1>Shift Schedules Master</h1>
          <p>Configure staff shift rosters, start check-in times, and end check-out schedules.</p>
        </div>
      </div>

      <ShiftList />
    </div>
  );
}
