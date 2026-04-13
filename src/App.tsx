import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import MapView from "./pages/MapView";
import Leaderboard from "./pages/Leaderboard";
import DataBrowser from "./pages/DataBrowser";
import DataEntry from "./pages/DataEntry";
import YourData from "./pages/YourData";
import WalletLogin from "./pages/WalletLogin";
import CreateAccount from "./pages/CreateAccount";
import WalletError from "./pages/WalletError";
import Help from "./pages/Help";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/misc/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterProvider } from './contexts/FilterContext'
import { CropThresholdProvider } from './contexts/CropThresholdContext';
import { WalletRelayProvider } from './contexts/WalletRelayContext';


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
      <Routes>
        {/* Redirect root to leaderboard */}
        <Route path="/" element={<Navigate to="/leaderboard" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<WalletLogin />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/wallet-error" element={<WalletError />} />
        <Route path="/help" element={<Help />} />
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
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <WalletRelayProvider>
          <WalletProvider>
            <AuthProvider>
              <FilterProvider>
                <CropThresholdProvider>
                  <RootContent />
                </CropThresholdProvider>
              </FilterProvider>
            </AuthProvider>
          </WalletProvider>
        </WalletRelayProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
