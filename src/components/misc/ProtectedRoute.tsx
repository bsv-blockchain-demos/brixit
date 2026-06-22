import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, authError, profileLoading } = useAuth();
  const location = useLocation();

  if (isLoading || profileLoading) {
    return (
      <div className="p-8 text-center text-sm">
        Loading user session...
      </div>
    );
  }

  if (authError) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        {authError}
        <br />
        <button 
          onClick={() => window.location.href = '/'}
          className="mt-2 text-primary hover:underline"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;