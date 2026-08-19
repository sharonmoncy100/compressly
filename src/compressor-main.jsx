import React from "react";
import { createRoot } from "react-dom/client";
import Compressor from "./compressor/Compressor";
import "./base.css";

/* Vercel Analytics */
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Compressor />
    <Analytics />
  </React.StrictMode>
);
