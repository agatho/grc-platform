"use client";
import { useState, useEffect, createContext, useContext } from "react";

type LayoutMode = "classic" | "modern";

const LayoutContext = createContext<{
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
}>({ layout: "modern", setLayout: () => {} });

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState<LayoutMode>("modern");

  useEffect(() => {
    const saved = localStorage.getItem("arctos-layout") as LayoutMode | null;
    if (saved) setLayout(saved);
  }, []);

  const updateLayout = (l: LayoutMode) => {
    setLayout(l);
    localStorage.setItem("arctos-layout", l);
  };

  return (
    <LayoutContext.Provider value={{ layout, setLayout: updateLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
