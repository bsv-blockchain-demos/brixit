import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MapView from "./pages/MapView";
import Leaderboard from "./pages/Leaderboard";
import DataBrowser from "./pages/DataBrowser";
import DataEntry from "./pages/DataEntry";
import YourData from "./pages/YourData";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import VerifyEmailNotice from "./pages/VerifyEmailNotice";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetPasswordOTP from "./pages/ResetPasswordOTP";
import AuthCallback from "./pages/AuthCallback";
import ProtectedRoute from "./components/misc/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterProvider } from './contexts/FilterContext'
import { CropThresholdProvider } from './contexts/CropThresholdContext';


const queryClient = new QueryClient();

const RootContent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">Loading application data...</p>
        <Skeleton className="h-4 w-[250px]" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to leaderboard */}
        <Route path="/" element={<Navigate to="/leaderboard" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmailNotice />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<NotFound />} />

        {/* Protected routes */}
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/data"
          element={
            <ProtectedRoute>
              <DataBrowser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/data-entry"
          element={
            <ProtectedRoute>
              <DataEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/your-data"
          element={
            <ProtectedRoute>
              <YourData />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <FilterProvider>
          <CropThresholdProvider>
            <RootContent />
          </CropThresholdProvider>
        </FilterProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;