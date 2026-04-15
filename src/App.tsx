import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
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
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/misc/ProtectedRoute";
import { FilterProvider } from './contexts/FilterContext'
import { CropThresholdProvider } from './contexts/CropThresholdContext';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { WalletRelayProvider } from './contexts/WalletRelayContext';


const queryClient = new QueryClient();

const RootContent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <AuthBackground>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">B</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-mid" />
        </div>
      </AuthBackground>
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
        <Route path="/faq" element={<Help />} />
        <Route path="/contact" element={<Contact />} />
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
    </ThemeProvider>
  </QueryClientProvider>
);


export default App;
