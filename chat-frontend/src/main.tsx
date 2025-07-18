import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App, notification } from "antd";
import AppChat from "./AppChat";

notification.config({
  placement: "topRight",
  bottom: 50,
  duration: 3,
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App>
      <AppChat />
    </App>
  </StrictMode>
); 