"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme?: Theme;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = "light",
}) => {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("theme", theme);
    const match = document.cookie.match(/\btheme=([^;]+)/);
    if (match ? match[1].trim() !== theme : true) {
      document.cookie = `theme=${theme}; path=/`;
    }
    const hasDark = document.documentElement.classList.contains("dark");
    if ((theme === "dark") !== hasDark) {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
