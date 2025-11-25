import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Vercel Analytics */
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    {/* Place Analytics once at the root so it tracks all page views */}
    <Analytics />
  </React.StrictMode>
);
