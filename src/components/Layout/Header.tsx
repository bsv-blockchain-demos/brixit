import React, { useState } from "react";
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

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
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
    logout();
  };

  const NavLinks = () => (
    <>
      <Link to="/leaderboard">
        <Button
          variant="ghost"
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/leaderboard") ? "bg-blue-mist text-green-fresh border border-green-fresh" : ""
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
            isActive("/map") ? "bg-blue-mist text-green-fresh border border-green-fresh" : ""
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
            isActive("/data") ? "bg-blue-mist text-green-fresh border border-green-fresh" : ""
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
            isActive("/your-data") ? "bg-blue-mist text-green-fresh border border-green-fresh" : ""
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
            className="flex items-center space-x-2 w-full justify-start bg-green-fresh hover:bg-green-mid text-white hover:text-white"
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
    <header className="bg-card shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/leaderboard" className="flex items-center">
            <div
              aria-label="Brixit"
              style={{
                height: '3.5rem',
                aspectRatio: '680.88 / 389.32',
                backgroundColor: 'var(--blue-deep)',
                WebkitMaskImage: 'url(/brixit.svg)',
                maskImage: 'url(/brixit.svg)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
              }}
            />
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
                      <span className="text-sm font-medium text-text-mid font-mono">{getDisplayName()}</span>
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
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                      <code className="flex-1 text-xs break-all font-mono">
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

        {/* Mobile Navigation */}
        {user && menuOpen && (
          <nav className="md:hidden py-4 space-y-2 border-t">
            <NavLinks />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2 w-full justify-start text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
