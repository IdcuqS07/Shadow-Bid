import { useState } from "react";
import { Outlet } from "react-router-dom";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Sidebar } from "@/components/layout/Sidebar";

export const AppShell = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" data-testid="app-shell">
      {/* Floating decorative shapes */}
      <div className="floating-shape floating-shape-1" />
      <div className="floating-shape floating-shape-2" />
      <div className="floating-shape floating-shape-3" />
      
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:pl-64 relative z-10">
        <HeaderBar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="page-enter mx-auto max-w-[1400px] px-6 py-6 md:px-10 md:py-8" data-testid="main-content-wrapper">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
