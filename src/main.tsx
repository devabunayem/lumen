import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./design/tokens.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root mount element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
