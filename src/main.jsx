import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Vercel Analytics */
import { Analytics } from "@vercel/analytics/react";

// --- Put this near the top of src/main.jsx (after imports) ---
function sendPageview(url = window.location.pathname + window.location.search) {
  // gtag might not be defined during development or if the script failed to load
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
}
// --- end helper ---


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    {/* Place Analytics once at the root so it tracks all page views */}
    <Analytics />
  </React.StrictMode>
);

// send initial pageview (SPA safe)
sendPageview();