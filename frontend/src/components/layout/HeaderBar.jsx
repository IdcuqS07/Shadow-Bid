import { Menu, Search, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

const routeLabels = {
  "/": "Dashboard",
  "/auctions": "Auctions",
  "/create": "Create Auction",
  "/commit-bid": "Commit Bid",
  "/reveal-bid": "Reveal Bid",
  "/settlement": "Settlement",
};

export const HeaderBar = ({ onOpenSidebar }) => {
  const location = useLocation();
  const currentLabel = routeLabels[location.pathname] || "Auction Detail";
  const { connecting } = useWallet();

  return (
    <header
      className="sticky top-0 z-20 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md"
      data-testid="top-header"
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            className="md:hidden"
            data-testid="sidebar-open-button"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400"
              data-testid="header-breadcrumb-parent"
            >
              ShadowBid / Workspace
            </p>
            <h2 className="text-xl font-bold text-white mt-1" data-testid="header-breadcrumb-current">
              {currentLabel}
            </h2>
          </div>
        </div>

        <div className="hidden w-full max-w-lg items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-2.5 md:flex shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <Input
            placeholder="Search auctions, vendors, or ID"
            className="border-0 bg-transparent p-0 text-base text-white placeholder:text-slate-400 shadow-none focus-visible:ring-0"
            data-testid="global-search-input"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <WalletMultiButton style={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-lg backdrop-blur-sm pointer-events-none">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              </div>
            )}
          </div>
          
          <NotificationCenter />
          
          <button
            className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-3 py-2 transition-colors duration-200 hover:bg-slate-700/50"
            data-testid="user-profile-trigger"
          >
            <img
              src="https://images.unsplash.com/photo-1738750908048-14200459c3c9?auto=format&fit=crop&w=200&q=80"
              alt="Profile"
              className="h-9 w-9 rounded-full object-cover"
              data-testid="user-profile-avatar"
            />
            <span className="hidden text-sm font-semibold text-white sm:inline" data-testid="user-profile-name">
              Procurement Team
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
