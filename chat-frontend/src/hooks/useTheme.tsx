import { createContext, useContext, useEffect, useState } from "react";
import { theme as antdTheme } from "antd";

const THEME_KEY = "chat-app-theme";

export type ThemeMode = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
  getAntdAlgorithm: () => any;
  getAntdTokens: () => Record<string, any>;
} | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || "system";
  });

  const getSystemDark = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const isDark =
    theme === "dark" || (theme === "system" && typeof window !== "undefined" && getSystemDark());

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else if (theme === "system") {
      if (getSystemDark()) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    if (theme === "system" && window.matchMedia) {
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const getAntdAlgorithm = () => {
    if (theme === "dark") return antdTheme.darkAlgorithm;
    if (theme === "light") return antdTheme.defaultAlgorithm;
    return getSystemDark() ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;
  };

  // Modern, high-contrast, visually distinct tokens for both themes
  const getAntdTokens = () => {
    if (isDark) {
      return {
        colorPrimary: "#2563eb", // vivid blue
        colorBgBase: "#0a0f1a", // very dark blue/black
        colorBgContainer: "#181f2a", // dark container
        colorTextBase: "#f3f6fa", // near white
        colorText: "#e0e6f0", // light text
        colorBorder: "#2d3748", // dark border
        colorFillSecondary: "#232b3a", // dark fill
        borderRadius: 16,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      };
    } else {
      return {
        colorPrimary: "#2563eb", // vivid blue
        colorBgBase: "#f8fafc", // very light
        colorBgContainer: "#ffffff", // white container
        colorTextBase: "#1e293b", // dark blue-gray
        colorText: "#334155", // blue-gray
        colorBorder: "#cbd5e1", // light border
        colorFillSecondary: "#e0e7ef", // light fill
        borderRadius: 16,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      };
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, getAntdAlgorithm, getAntdTokens }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}; 