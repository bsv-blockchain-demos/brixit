import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
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
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BrixLogo } from "@/components/common/BrixLogo";

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const { resetWalletState } = useWallet();
  const { cancelSession } = useWalletRelay();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyKey = async () => {
    if (!user?.identity_key) return;
    await navigator.clipboard.writeText(user.identity_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const NavLinks = () => (
    <>
      <Link to="/leaderboard">
        <Button
          variant="ghost"
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/leaderboard") ? "text-white border-b-2 border-white rounded-b-none pb-1" : "text-on-bg-text hover:text-accent-foreground"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Leaderboard</span>
        </Button>
      </Link>

      <Link to="/map">
        <Button
          variant="ghost"
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/map") ? "text-white border-b-2 border-white rounded-b-none pb-1" : "text-on-bg-text hover:text-accent-foreground"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Explorer</span>
        </Button>
      </Link>

      <Link to="/data">
        <Button
          variant="ghost"
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/data") ? "text-white border-b-2 border-white rounded-b-none pb-1" : "text-on-bg-text hover:text-accent-foreground"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data</span>
        </Button>
      </Link>

      <Link to="/your-data">
        <Button
          variant="ghost"
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/your-data") ? "text-white border-b-2 border-white rounded-b-none pb-1" : "text-on-bg-text hover:text-accent-foreground"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Your Data</span>
        </Button>
      </Link>

      {hasRole("contributor") && (
        <Link to="/data-entry">
          <Button
            variant={isActive("/data-entry") ? "default" : "ghost"}
            className="flex items-center space-x-2 w-full justify-start bg-action-primary hover:bg-action-primary-hover text-white hover:text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Submit</span>
          </Button>
        </Link>
      )}

      {isAdmin && (
        <Link to="/admin">
          <Button
            variant={isActive("/admin") ? "default" : "ghost"}
            className={`flex items-center space-x-2 w-full justify-start ${
              isActive("/admin") ? "border-b-2 border-gold" : ""
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
    <header className="bg-background border-b border-white/30 pt-[var(--safe-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/leaderboard" className="flex items-center">
            <BrixLogo height="3rem" color="white" />
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center space-x-4">
              <NavLinks />
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
              className="relative"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            </Button>
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
                      <span className="text-sm font-medium text-on-bg-text font-mono">{getDisplayName()}</span>
                      {user.role === "admin" && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          Admin
                        </Badge>
                      )}
                      {user.role === "contributor" && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Contributor
                        </Badge>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Identity Key
                  </DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-2 rounded-md bg-blue-mist px-3 py-2">
                      <code className="flex-1 text-xs break-all font-mono text-card-foreground">
                        {user.identity_key}
                      </code>
                      <button
                        onClick={handleCopyKey}
                        className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                        aria-label="Copy identity key"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-fresh" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/delete-account.html" target="_blank" rel="noopener noreferrer" className="text-destructive focus:text-destructive cursor-pointer">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Account
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex items-center gap-3">
                    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</a>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
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

        {/* Mobile Navigation — full-screen overlay below the header bar: nav rows on
            steel + an elevated account panel (parity with the desktop Profile
            dropdown). Desktop nav (md:flex) + Profile dropdown are untouched. */}
        {user && menuOpen && (
          <nav
            className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background overflow-y-auto px-2 pt-3 space-y-4"
            style={{ top: "calc(var(--safe-top) + 4rem)", paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}
          >
            {/* Nav rows (on steel) */}
            <div className="space-y-1">
              {[
                { to: "/leaderboard", icon: Trophy, label: "Leaderboard" },
                { to: "/map", icon: Eye, label: "Explorer" },
                { to: "/data", icon: Database, label: "Data" },
                { to: "/your-data", icon: User, label: "Your Data" },
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
                      className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg bg-action-primary text-white hover:bg-action-primary-hover font-medium"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
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
                    className="flex items-center gap-3 min-h-[44px] px-3 rounded-lg text-on-bg-text hover:bg-white/10"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={active ? "border-b-2 border-white pb-0.5 font-semibold" : ""}>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Account panel — elevated surface, hairline-separated regions */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--menu-surface)", borderColor: "var(--menu-surface-border)" }}
            >
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-deep text-white">{getUserInitial()}</AvatarFallback>
                </Avatar>
                <span className="flex-1 min-w-0 truncate font-mono text-sm text-on-bg-text">{getDisplayName()}</span>
                {user.role === "admin" && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">Admin</span>
                )}
                {user.role === "contributor" && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-action-primary text-white">Contributor</span>
                )}
              </div>

              <div className="px-3 pb-3 pt-3 border-t" style={{ borderColor: "var(--menu-surface-border)" }}>
                <p className="text-[11px] uppercase tracking-wider text-on-bg-subtle mb-1.5">Identity Key</p>
                <div className="flex items-center gap-2 rounded-md px-3 py-2" style={{ backgroundColor: "var(--menu-inset)" }}>
                  <code className="flex-1 min-w-0 truncate text-xs font-mono text-on-bg-text">{user.identity_key}</code>
                  <button
                    onClick={handleCopyKey}
                    className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                    aria-label="Copy identity key"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-fresh" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-on-bg-subtle" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t" style={{ borderColor: "var(--menu-surface-border)" }}>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 min-h-[44px] text-sm font-medium text-on-bg-text hover:bg-white/10"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 min-h-[44px] text-sm font-medium text-on-bg-text hover:bg-white/10"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Edit Profile</span>
                </Link>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
