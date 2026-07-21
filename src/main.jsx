import React from "react";
import { createRoot } from "react-dom/client";
import PaleVigil from "./PaleVigil.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PaleVigil />
  </React.StrictMode>
);

// Register the service worker so the game is installable / works offline from the home screen.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
