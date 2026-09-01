import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { RoleChip } from "@/components/common/RoleChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import { useWalletRelay } from "../../contexts/WalletRelayContext";
import { formatUsername } from "../../lib/formatUsername";
import {
  Eye,
  Database,
  Plus,
  User,
  LogOut,
  Trophy,
  Menu,
  X,
  Shield,
  Sun,
  Moon,
  ArrowRight,
  ClipboardList,
  Settings as SettingsIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { BrixLogo } from "@/components/common/BrixLogo";
import { IdentityKey } from "@/components/common/IdentityKey";

// Plain destinations that share the sliding underline. Submit and Admin are
// deliberately outside this list: they carry their own button treatment.
const NAV_LINKS = [
  { to: "/map", icon: Eye, label: "Explorer" },
  { to: "/leaderboard", icon: Trophy, label: "Places" },
  { to: "/data", icon: Database, label: "Readings" },
  { to: "/my-data", icon: ClipboardList, label: "My Readings" },
] as const;

/**
 * Last known underline geometry, kept at module scope on purpose.
 *
 * Every page renders its own <Header />, so a route change unmounts and
 * remounts the whole header rather than reusing it. Component state cannot
 * survive that, and without a previous position the indicator would mount
 * already at its destination and appear to jump. Holding it here lets the
 * fresh instance animate from where the old one left off.
 */
let lastIndicator: { left: number; width: number } | null = null;

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const { resetWalletState } = useWallet();
  const { cancelSession } = useWalletRelay();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Geometry of the active desktop nav link, used to place the underline.
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState(lastIndicator);
  // Captured on first render, before the measuring effect overwrites the
  // module value: where the underline sat on the route we came from.
  const originRef = useRef(lastIndicator);

  // Lock background scroll while the full-screen mobile menu is open so the
  // header's close (X) stays reachable. Mobile-only (menuOpen is only set by the
  // md:hidden toggle), so desktop is unaffected.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  const isActive = (path: string) => location.pathname === path;

  // Re-measure on route change, and on resize since the links reflow.
  // useLayoutEffect so the first paint already has the underline in place.
  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>('[data-nav-active]');
      // No underline on routes outside NAV_LINKS (Submit, Admin, Profile...).
      const next = active ? { left: active.offsetLeft, width: active.offsetWidth } : null;
      lastIndicator = next;
      setIndicator(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [location.pathname, user, isAdmin]);

  // resolvedTheme collapses "system" to the theme actually applied, so the
  // label always names the mode the user would switch *to* and the toggle
  // never no-ops on a system-themed session.
  const isDark = (resolvedTheme ?? theme) === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    if (role === "admin") return user.role === "admin";
    if (role === "contributor")
      return user.role === "contributor" || user.role === "admin";
    return false;
  };

  const getDisplayName = (): string => {
    if (!user?.display_name) return "";
    return formatUsername(user.display_name.replace(/[<>]/g, ""));
  };

  const getUserInitial = (): string => {
    const displayName = getDisplayName();
    return displayName ? displayName.charAt(0).toUpperCase() : "U";
  };

  const handleLogout = () => {
    cancelSession();
    resetWalletState();
    logout();
  };

  // One persistent indicator positioned from the active link's measured box,
  // rather than a layoutId shared between mounting/unmounting elements. The
  // shared-layout approach left the incoming element stuck on its inverted
  // "from" transform, and measuring is deterministic besides.
  const navLinks = (
    <>
      {NAV_LINKS.map(({ to, icon: Icon, label }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            data-nav-active={active || undefined}
            // Full row height so the indicator's bottom-0 lands on the header's
            // bottom edge instead of directly under the text.
            className="relative flex items-center h-16"
          >
            <Button
              variant="ghost"
              // hover:text-white sits in the base, not the inactive branch, so
              // it also displaces the ghost variant's hover:text-accent-foreground
              // on the active link. Icons inherit via currentColor.
              className={`flex items-center space-x-2 hover:bg-transparent hover:text-white ${
                active ? "text-white" : "text-on-bg-text"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Button>
          </Link>
        );
      })}

      {hasRole("contributor") && (
        <Link to="/data-entry">
          <Button
            variant={isActive("/data-entry") ? "default" : "ghost"}
            className="flex items-center space-x-2 w-full justify-start rounded-lg bg-action-primary hover:bg-action-primary-hover text-white hover:text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Submit</span>
          </Button>
        </Link>
      )}

      {isAdmin && (
        <Link to="/admin">
          <Button
            variant="ghost"
            className={`flex items-center space-x-2 w-full justify-start rounded-lg border text-white hover:text-white ${
              isActive("/admin")
                ? "bg-white/20 border-white/30 hover:bg-white/20"
                : "bg-menu-surface border-menu-surface-border hover:bg-white/15"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </Button>
        </Link>
      )}
    </>
  );

  return (
    // Frosted, borderless top bar. The translucency reveals PageBackground's
    // fixed wallpaper, which paints above the page fill and below this bar.
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md pt-[var(--safe-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo: signed-in users go to the app map; signed-out visitors go to the home/landing page */}
          <Link to={user ? '/map' : '/'} className="flex items-center">
            <BrixLogo height="3rem" color="white" />
          </Link>

          {/* Desktop Navigation */}
          {user && (
            // gap-4, not space-x-4: the latter sets margin-left on every child
            // after the first, which would also shove the absolutely positioned
            // indicator 16px right of its measured offset.
            <nav ref={navRef} className="relative hidden md:flex items-center h-16 gap-4">
              {navLinks}
              {indicator && (
                <motion.span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-[3px] rounded-full bg-white"
                  // Animate in from the previous route's position. On a cold
                  // load there is none, so initial={false} puts it straight
                  // under the active link instead of sliding in from the left.
                  initial={
                    originRef.current
                      ? { x: originRef.current.left, width: originRef.current.width }
                      : false
                  }
                  animate={{ x: indicator.left, width: indicator.width }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 40 }
                  }
                />
              )}
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Signed-in users toggle the theme from the account menu below.
                Signed-out visitors (/map is public) have no account menu, so
                they keep the standalone control. */}
            {!user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                className="relative"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              </Button>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 cursor-pointer hover:opacity-80 focus:outline-none">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-deep text-white">
                        {getUserInitial()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex items-center space-x-1.5">
                      <span className="text-sm font-medium text-on-bg-text">{getDisplayName()}</span>
                      {(user.role === "admin" || user.role === "contributor") && (
                        <RoleChip role={user.role} />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identity Key
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <div className="flex items-center rounded-md bg-surface-canvas border border-hairline px-3 py-2">
                      <IdentityKey
                        value={user.identity_key}
                        className="flex-1 text-card-foreground"
                      />
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    // Keep the menu open so the theme change is visible in place;
                    // a toggle that dismissed its own trigger would be awkward to
                    // flip back.
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleTheme();
                    }}
                    className="cursor-pointer"
                  >
                    {isDark ? (
                      <Sun className="mr-2 h-4 w-4" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4" />
                    )}
                    {isDark ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation — full-height steel panel with its own header, nav
            list, and a bottom account card. Desktop nav + dropdown are untouched.
            This panel carries no Identity Key (it is in the desktop dropdown and
            on Profile) and no account deletion (that lives on Settings). */}
        {user && menuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col pt-[var(--safe-top)]">
            {/* Panel header */}
            <div className="flex items-center justify-between h-16 px-4 shrink-0 border-b border-white/20">
              <BrixLogo height="2rem" color="white" />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle dark mode"
                  className="relative text-white hover:bg-white/10"
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="text-white hover:bg-white/10"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Nav list */}
            <nav className="flex-1 overflow-y-auto px-4 pt-4 space-y-1">
              {[
                { to: "/map", icon: Eye, label: "Explorer" },
                { to: "/leaderboard", icon: Trophy, label: "Places" },
                { to: "/data", icon: Database, label: "Readings" },
                { to: "/my-data", icon: ClipboardList, label: "My Readings" },
                ...(hasRole("contributor") ? [{ to: "/data-entry", icon: Plus, label: "Submit", primary: true }] : []),
                ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin" }] : []),
              ].map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                if (item.primary) {
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 my-1 rounded-lg bg-action-primary hover:bg-action-primary-hover text-white font-semibold text-[17px]"
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                if (item.to === "/admin") {
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-3 my-1 rounded-lg border text-white font-semibold text-[17px] ${
                        active
                          ? "bg-white/20 border-white/30"
                          : "bg-menu-surface border-menu-surface-border hover:bg-white/15"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center min-h-[48px] text-[17px] text-white"
                  >
                    <span className={`inline-flex items-center gap-3 ${active ? "border-b-2 border-white pb-1 pr-3 font-bold" : ""}`}>
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Account card pinned to bottom */}
            <div className="px-4" style={{ paddingBottom: "calc(1rem + var(--bottom-inset))" }}>
              <div className="rounded-2xl" style={{ backgroundColor: "var(--menu-surface)" }}>
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-deep text-white">{getUserInitial()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{getDisplayName()}</div>
                    <RoleChip role={user.role} className="mt-0.5" />
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Link>
                </div>
                <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.20)" }} />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 min-h-[44px] text-sm font-medium text-white hover:bg-white/10 rounded-b-2xl"
                >
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
