import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { useAuth } from "../../contexts/AuthContext";
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
} from "lucide-react";

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
    return user.display_name.replace(/[<>]/g, "");
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
          variant={isActive("/leaderboard") ? "default" : "ghost"}
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/leaderboard") ? "border-b-2 border-green-600" : ""
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Leaderboard</span>
        </Button>
      </Link>

      <Link to="/map">
        <Button
          variant={isActive("/map") ? "default" : "ghost"}
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/map") ? "border-b-2 border-green-600" : ""
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Explorer</span>
        </Button>
      </Link>

      <Link to="/data">
        <Button
          variant={isActive("/data") ? "default" : "ghost"}
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/data") ? "border-b-2 border-green-600" : ""
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data</span>
        </Button>
      </Link>

      <Link to="/your-data">
        <Button
          variant={isActive("/your-data") ? "default" : "ghost"}
          className={`flex items-center space-x-2 w-full justify-start ${
            isActive("/your-data") ? "border-b-2 border-green-600" : ""
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
            className="flex items-center space-x-2 w-full justify-start bg-green-600 hover:bg-green-700 text-white"
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
              isActive("/admin") ? "border-b-2 border-orange-600" : ""
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
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/leaderboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">BRIX</span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center space-x-4">
              <NavLinks />
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/profile">
                  <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-green-600 text-white">
                        {getUserInitial()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block">
                      <div className="text-sm font-medium text-gray-700">
                        {getDisplayName()}
                      </div>
                      <div className="flex items-center space-x-1">
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
                    </div>
                  </div>
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </>
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
              className="flex items-center space-x-2 w-full justify-start text-red-600"
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
