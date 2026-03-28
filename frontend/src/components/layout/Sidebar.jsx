import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  PlusCircle,
  Wallet,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  Eye,
  Store,
  Users,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useAleoBalance } from "@/hooks/useAleoBalance";
import { useUnrevealedBids } from "@/hooks/useUnrevealedBids";
import { isPlatformOwner } from "@/services/aleoServiceV2";

const sellerNavItems = [
  { to: "/create", label: "Create Auction", icon: PlusCircle },
  { to: "/settlement", label: "Manage Settlement", icon: Wallet },
];

const bidderNavItems = [
  { to: "/commit-bid", label: "Commit Bid", icon: Zap },
  { to: "/reveal-bid", label: "Reveal Bid", icon: Eye },
  { to: "/settlement", label: "Claim Refund", icon: Wallet },
];

export const Sidebar = ({ mobileOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [bidderExpanded, setBidderExpanded] = useState(false);
  const { connected, address } = useWallet();
  const { formatted, loading } = useAleoBalance();
  const { totalUnrevealed } = useUnrevealedBids();
  const showAdminConsole = Boolean(address && isPlatformOwner(address));

  const shouldShowContent = !isCollapsed || isHovered;

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 bg-slate-900 px-4 py-6 transition-all duration-300 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          shouldShowContent ? "w-64" : "w-20"
        }`}
        data-testid="main-sidebar"
      >
        <div className="mb-8 flex items-center justify-between">
          {shouldShowContent ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400" data-testid="brand-kicker">
                Zero Knowledge
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white" data-testid="brand-title">
                ShadowBid
              </h1>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <p className="text-xl font-bold text-white">SB</p>
            </div>
          )}
          
          {shouldShowContent && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-300 hover:bg-slate-800 md:hidden"
                data-testid="sidebar-close-button"
              >
                <X />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden text-slate-300 hover:bg-slate-800 md:flex"
                data-testid="sidebar-collapse-button"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>

        <nav className="space-y-2" data-testid="sidebar-nav-list">
          {/* Dashboard Section with Dropdown */}
          <div>
            {shouldShowContent ? (
              <button
                onClick={() => setDashboardExpanded(!dashboardExpanded)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 text-slate-300 hover:bg-slate-800/70 hover:text-white"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  <span>Dashboard</span>
                </div>
                {dashboardExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <LayoutDashboard className="h-4 w-4 text-slate-300" />
              </div>
            )}

            {/* Dashboard Sub-items */}
            {(dashboardExpanded || !shouldShowContent) && (
              <div className="mt-1 space-y-1">
                {/* Home */}
                <NavLink
                  to="/"
                  onClick={onClose}
                  data-testid="nav-link-home"
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${
                      shouldShowContent ? "pl-10" : "justify-center"
                    }`
                  }
                  title={!shouldShowContent ? "Home" : ""}
                >
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  {shouldShowContent && <span>Home</span>}
                </NavLink>

                {/* Browse Auctions */}
                <NavLink
                  to="/auctions"
                  onClick={onClose}
                  data-testid="nav-link-browse-auctions"
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${
                      shouldShowContent ? "pl-10" : "justify-center"
                    }`
                  }
                  title={!shouldShowContent ? "Browse Auctions" : ""}
                >
                  <List className="h-4 w-4 flex-shrink-0" />
                  {shouldShowContent && <span>Browse Auctions</span>}
                </NavLink>

                {/* How It Works */}
                <NavLink
                  to="/how-it-works"
                  onClick={onClose}
                  data-testid="nav-link-how-it-works"
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${
                      shouldShowContent ? "pl-10" : "justify-center"
                    }`
                  }
                  title={!shouldShowContent ? "How It Works" : ""}
                >
                  <BookOpen className="h-4 w-4 flex-shrink-0" />
                  {shouldShowContent && <span>How It Works</span>}
                </NavLink>

                {showAdminConsole && (
                  <NavLink
                    to="/admin-v3"
                    onClick={onClose}
                    data-testid="nav-link-prototype-console"
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                      } ${
                        shouldShowContent ? "pl-10" : "justify-center"
                      }`
                    }
                    title={!shouldShowContent ? "Ops Console" : ""}
                  >
                    <Bot className="h-4 w-4 flex-shrink-0" />
                    {shouldShowContent && <span>Ops Console</span>}
                  </NavLink>
                )}
              </div>
            )}
          </div>

          {/* Seller Section */}
          <div>
            {shouldShowContent ? (
              <button
                onClick={() => setSellerExpanded(!sellerExpanded)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Store className="h-3 w-3" />
                  <span>Seller</span>
                </div>
                {sellerExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <Store className="h-4 w-4 text-slate-500" />
              </div>
            )}
            {(sellerExpanded || !shouldShowContent) && sellerNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${
                      !shouldShowContent ? "justify-center" : ""
                    }`
                  }
                  title={!shouldShowContent ? item.label : ""}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {shouldShowContent && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>

          {/* Bidder Section */}
          <div>
            {shouldShowContent ? (
              <button
                onClick={() => setBidderExpanded(!bidderExpanded)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span>Bidder</span>
                </div>
                {bidderExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
            )}
            {(bidderExpanded || !shouldShowContent) && bidderNavItems.map((item) => {
              const Icon = item.icon;
              const isRevealBid = item.to === '/reveal-bid';
              const showBadge = isRevealBid && totalUnrevealed > 0;
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${
                      !shouldShowContent ? "justify-center" : ""
                    }`
                  }
                  title={!shouldShowContent ? item.label : ""}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {shouldShowContent && (
                    <>
                      <span>{item.label}</span>
                      {showBadge && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                          {totalUnrevealed > 9 ? '9+' : totalUnrevealed}
                        </span>
                      )}
                    </>
                  )}
                  {!shouldShowContent && showBadge && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {totalUnrevealed > 9 ? '9' : totalUnrevealed}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {shouldShowContent && connected && (
          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400" data-testid="wallet-summary-label">
              Wallet Summary
            </p>
            <p className="mt-2 text-xl font-semibold text-white" data-testid="wallet-summary-balance">
              {loading ? 'Loading...' : (formatted ?? '—')}
            </p>
            <p className="mt-1 text-xs text-slate-300" data-testid="wallet-summary-note">
              Available for bid deposits
            </p>
          </div>
        )}
      </aside>

      {mobileOpen ? (
        <button
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/45 md:hidden"
          data-testid="sidebar-overlay"
          aria-label="Close sidebar overlay"
        />
      ) : null}
    </>
  );
};
