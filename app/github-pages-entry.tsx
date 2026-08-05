import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CancioneiroApp } from "./components/CancioneiroApp";
import "./globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <CancioneiroApp />
  </StrictMode>,
);
