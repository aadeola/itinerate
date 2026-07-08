import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyThemeClass } from "./hooks/use-theme";
import "./index.css";
import "leaflet/dist/leaflet.css";

applyThemeClass(
  (() => {
    const stored = localStorage.getItem("itinerate-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  })(),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
