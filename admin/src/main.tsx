import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";

// Temporary placeholder until App.tsx is created in Task 9
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div style={{ color: "#F0F0F0", padding: 40 }}>
      <h1>GRID Admin</h1>
      <p>Scaffolding complete. App shell coming in Task 9.</p>
    </div>
  </React.StrictMode>,
);
