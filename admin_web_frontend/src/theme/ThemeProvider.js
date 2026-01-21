import React, { createContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

/**
 * Apply theme values via data attributes so CSS can reference them.
 * @param {"light"|"dark"} mode
 */
function applyMode(mode) {
  document.documentElement.setAttribute("data-theme", mode);
}

// PUBLIC_INTERFACE
export function useTheme() {
  /** This is a public function returning theme context (mode + setter). */
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// PUBLIC_INTERFACE
export default function ThemeProvider({ children }) {
  /** This is a public component providing app theme state. */
  const [mode, setMode] = useState("light");

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

