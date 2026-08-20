import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { sendLinksToTheBrowser } from "./lib/external.js";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element.");

sendLinksToTheBrowser();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
