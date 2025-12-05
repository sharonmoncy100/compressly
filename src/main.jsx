import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Vercel Analytics */
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);
