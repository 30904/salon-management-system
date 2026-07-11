import { createContext, useContext, useState } from "react";

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  const value = {
    collapsed,
    setCollapsed,
    toggleSidebar: () => setCollapsed((prev) => !prev),
  };

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error("useShell must be used within ShellProvider");
  }

  return context;
}
