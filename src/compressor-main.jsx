import React from "react";
import { createRoot } from "react-dom/client";
import Compressor from "./compressor/Compressor";
import "./base.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Compressor />
  </React.StrictMode>
);
