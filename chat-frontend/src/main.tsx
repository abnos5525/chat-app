import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App, notification } from "antd";
import AppChat from "./AppChat";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/useTheme";

notification.config({
  placement: "topRight",
  bottom: 50,
  duration: 3,
});

const queryClient = new QueryClient();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App>
          <AppChat />
        </App>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
