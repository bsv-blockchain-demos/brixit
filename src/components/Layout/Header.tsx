import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { RoleChip } from "@/components/common/RoleChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import { useWalletRelay } from "../../contexts/WalletRelayContext";
import { formatUsername } from "../../lib/formatUsername";
import {
  Map,
  Store,
  Droplets,
  Info,
  ShoppingCart,
  Plus,
  User,
  LogOut,
  X,
  Shield,
  Sun,
  Moon,
  ArrowRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { BrixLogo } from "@/components/common/BrixLogo";

// Plain destinations that share the sliding underline. Submit and Admin are
// deliberately outside this list: they carry their own button treatment.
const NAV_LINKS = [
  // Icons follow the renames: Map for the map, Store for the place rankings,
  // Droplets for a refractometer reading. Trophy read as "leaderboard" and
  // Database as "some table", neither of which is what these pages are now.
  { to: "/map", icon: Map, label: "Explorer" },
  { to: "/leaderboard", icon: Store, label: "Places" },
  { to: "/data", icon: Droplets, label: "Readings" },
  { to: "/about", icon: Info, label: "About" },
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
      {user && NAV_LINKS.map(({ to, icon: Icon, label }) => {
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

      {/* Add and Buy read as one split control when both are present. Buy is
          not gated on the contributor role: observers are exactly the people
          who do not have a meter yet, so when Add is absent Buy stands alone
          and takes the full rounding. */}
      <div className="flex items-center">
        {hasRole("contributor") && (
          <Link to="/data-entry">
            <Button
              variant={isActive("/data-entry") ? "default" : "ghost"}
              className="flex items-center space-x-2 justify-start rounded-l-lg rounded-r-none bg-action-primary hover:bg-action-primary-hover text-white hover:text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </Button>
          </Link>
        )}
        <Link to="/buy">
          <Button
            variant="ghost"
            // Inverts against the orange Add: the app surface colour with the
            // app ink on it, so it flips with the theme rather than being a
            // second accent competing for the same attention.
            className={`flex items-center space-x-2 justify-start bg-card text-text-dark hover:bg-surface-canvas hover:text-text-dark ${
              hasRole("contributor") ? "rounded-l-none rounded-r-lg" : "rounded-lg"
            } ${isActive("/buy") ? "ring-2 ring-inset ring-white/50" : ""}`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Buy</span>
          </Button>
        </Link>
      </div>

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
            <span>Steward</span>
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
          <Link to={user ? '/map' : '/'} className="flex items-center py-2">
            <BrixLogo height="2.5rem" color="white" />
          </Link>

          {/* Desktop Navigation. Rendered for everyone: Buy lives in here and
              is offered to signed-out visitors too. The destinations and the
              underline are still signed-in only.

              Signed-out visitors only ever get the lone Buy button here — the
              destination links above are gated on `user`. With the row's
              default justify-start (and the outer bar's justify-between
              splitting its free space across all three children), that one
              button floated in the dead space near the middle of the header,
              nowhere near the logo or the login control. flex-1 + justify-end
              (signed-out only) instead has it hug the right side, next to
              theme toggle/Login, since there's nothing left of it to align
              against. */}
          {
            // gap-4, not space-x-4: the latter sets margin-left on every child
            // after the first, which would also shove the absolutely positioned
            // indicator 16px right of its measured offset.
            <nav
              ref={navRef}
              className={`relative hidden md:flex items-center h-16 gap-4 ${user ? '' : 'flex-1 justify-end'}`}
            >
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
          }

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

            {/* Mobile menu toggle. Bars animate into an X (and back) instead of
                swapping icons outright — this is the same control the panel's
                own close button is, in its other state, so it gets the same
                text-white hover:bg-white/10 treatment rather than the ghost
                variant's light-surface default (hover:bg-accent reads as a
                pale, near-white blob against this dark, translucent bar). */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-white hover:bg-white/10"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                // The portaled panel has its own close button once open, and
                // fully covers this one — without this it'd sit reachable by
                // keyboard (tab order ignores z-index) and duplicate that
                // button's "Close menu" label in the a11y tree.
                aria-hidden={menuOpen}
                tabIndex={menuOpen ? -1 : 0}
              >
                <span className="relative w-6 h-6 flex items-center justify-center" aria-hidden="true">
                  <motion.span
                    className="absolute h-0.5 w-5 rounded-full bg-current"
                    animate={menuOpen ? { y: 0, rotate: 45 } : { y: -6, rotate: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="absolute h-0.5 w-5 rounded-full bg-current"
                    animate={menuOpen ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="absolute h-0.5 w-5 rounded-full bg-current"
                    animate={menuOpen ? { y: 0, rotate: -45 } : { y: 6, rotate: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
                  />
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Navigation — full-height steel panel with its own header, nav
            list, and a bottom account card. Desktop nav + dropdown are untouched.
            This panel carries no Identity Key (it is in the desktop dropdown and
            on Profile) and no account deletion (that lives on Settings).

            Portaled to <body>: `header` has `backdrop-blur-md`, and
            `backdrop-filter` (like `filter`/`transform`) makes its element the
            containing block for `position: fixed` descendants. Left in place,
            this panel's `inset-0` resolved against the *header's* 64px box
            instead of the viewport — the whole menu rendered squashed into
            the header's own height, with the map page showing through below
            it. Portaling escapes that containing block entirely. */}
        {user && menuOpen && createPortal(
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

            {/* Nav list. Two groups, not one flat map: the plain destination
                links center in whatever space is left above Add/Steward,
                which stay pinned to the bottom of the panel (just above the
                account card) instead of scrolling around in the middle of
                the list with everything else. */}
            <nav className="flex-1 overflow-y-auto px-4 pt-4 flex flex-col">
              <div className="flex-1 flex flex-col justify-center space-y-1">
                {[
                  { to: "/map", icon: Map, label: "Explorer" },
                  { to: "/leaderboard", icon: Store, label: "Places" },
                  { to: "/data", icon: Droplets, label: "Readings" },
                  { to: "/about", icon: Info, label: "About" },
                  { to: "/buy", icon: ShoppingCart, label: "Buy" },
                ].map(({ to, icon: Icon, label }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="flex items-center justify-center min-h-[48px] text-[17px] text-white"
                    >
                      <span className={`inline-flex items-center gap-3 ${active ? "border-b-2 border-white pb-1 pr-3 font-bold" : ""}`}>
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{label}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              {(hasRole("contributor") || isAdmin) && (
                <div className="space-y-1 pt-2 pb-1">
                  {hasRole("contributor") && (
                    <Link
                      to="/data-entry"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 my-1 rounded-lg bg-action-primary hover:bg-action-primary-hover text-white font-semibold text-[17px]"
                    >
                      <Plus className="w-5 h-5 shrink-0" />
                      <span>Add</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive("/admin") ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 py-3 my-1 rounded-lg border text-white font-semibold text-[17px] ${
                        isActive("/admin")
                          ? "bg-white/20 border-white/30"
                          : "bg-menu-surface border-menu-surface-border hover:bg-white/15"
                      }`}
                    >
                      <Shield className="w-5 h-5 shrink-0" />
                      <span>Steward</span>
                    </Link>
                  )}
                </div>
              )}
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
          </div>,
          document.body
        )}
      </div>
    </header>
  );
};

export default Header;
