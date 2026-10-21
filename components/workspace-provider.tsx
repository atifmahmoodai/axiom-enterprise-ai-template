"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { TenantId } from "@/lib/config";
type WorkspaceContext = {
  tenantId: TenantId;
  setTenantId: (id: TenantId) => void;
};
const Context = createContext<WorkspaceContext | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenant] = useState<TenantId>("atlas");
  useEffect(() => {
    try {
      const value = localStorage.getItem("axiom:workspace");
      if (value === "atlas" || value === "helix") setTenant(value);
    } catch {}
  }, []);
  const setTenantId = (id: TenantId) => {
    setTenant(id);
    try {
      localStorage.setItem("axiom:workspace", id);
    } catch {}
  };
  return (
    <Context.Provider value={{ tenantId, setTenantId }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useWorkspace requires WorkspaceProvider");
  return ctx;
}
