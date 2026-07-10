import React, { useState } from "react";
import ShiftList from "./ShiftList.jsx";
import AttendanceRulesForm from "./AttendanceRulesForm.jsx";
import "./AttendanceSettings.css";

export default function AttendanceMasterHome() {
  const [activeTab, setActiveTab] = useState("shifts"); // 'shifts' | 'rules'

  return (
    <div className="attendance-settings-container">
      {/* Header Banner */}
      <div className="attendance-header-banner">
        <div className="attendance-banner-text">
          <h1>Shift Schedules & Attendance Rules</h1>
          <p>Configure staff working hours, check-in thresholds, late marks, and annual leave quotas.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="attendance-tabs">
        <button
          type="button"
          className={`attendance-tab-btn ${activeTab === "shifts" ? "active" : ""}`}
          onClick={() => setActiveTab("shifts")}
        >
          ⏰ Shift Schedules Roster
        </button>
        <button
          type="button"
          className={`attendance-tab-btn ${activeTab === "rules" ? "active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          📋 Attendance Threshold & Leave Rules
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "shifts" ? <ShiftList /> : <AttendanceRulesForm />}
    </div>
  );
}
