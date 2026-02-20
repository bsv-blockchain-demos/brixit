// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  apiPost,
  apiGet,
  apiPut,
  setTokens,
  clearTokens,
  getAccessToken,
  loadTokensFromStorage,
} from "@/lib/api";

interface UserProfile {
  id: string;
  display_name: string | null;
  role: string | null;
  points?: number | null;
  submission_count?: number | null;
  last_submission?: string | null;
  email?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
}

interface LocationData {
  country: string;
  state: string;
  city: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;       // session loading
  profileLoading: boolean;  // profile loading
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    location?: LocationData
  ) => Promise<boolean>;
  updateUsername: (newUsername: string) => Promise<boolean>;
  updateLocation: (location: LocationData) => Promise<boolean>;
  walletLogin: (identityKey: string, certificate: any, userData: any) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await apiGet<{
      id: string;
      email: string | null;
      display_name: string | null;
      country: string | null;
      state: string | null;
      city: string | null;
      points: number | null;
      submission_count: number | null;
      last_submission: string | null;
      roles: string[];
    }>("/api/users/me");

    // Determine highest role
    let userRole = "user";
    if (data.roles?.includes("admin")) {
      userRole = "admin";
    } else if (data.roles?.includes("contributor")) {
      userRole = "contributor";
    }

    return {
      id: data.id,
      display_name: data.display_name,
      role: userRole,
      email: data.email,
      country: data.country,
      state: data.state,
      city: data.city,
      points: data.points,
      submission_count: data.submission_count,
      last_submission: data.last_submission,
    };
  } catch (err: any) {
    console.error("[fetchUserProfile] Error:", err.message || err);
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // session loading
  const [profileLoading, setProfileLoading] = useState(true); // profile loading

  const isAdmin = user?.role === "admin";

  const loadSession = async () => {
    setIsLoading(true);
    setProfileLoading(true);
    try {
      loadTokensFromStorage();
      const token = getAccessToken();

      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      // Validate token by fetching profile
      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        // Token is invalid or expired
        clearTokens();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error("Error loading session:", err);
      clearTokens();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  // Email/password auth stubs — wallet-only auth now, these are kept for interface compat
  const register = async (
    _email: string,
    _password: string,
    _displayName: string,
    _location?: LocationData
  ): Promise<boolean> => {
    setAuthError("Registration is handled via wallet login.");
    return false;
  };

  const login = async (_email: string, _password: string): Promise<boolean> => {
    setAuthError("Email/password login is no longer supported. Please use wallet login.");
    return false;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiPost("/api/auth/logout", {}).catch(() => {});
    } catch {
      // ignore
    } finally {
      clearTokens();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    }
  };

  const updateUsername = async (newUsername: string): Promise<boolean> => {
    if (!user) {
      setAuthError("Not authenticated.");
      return false;
    }

    try {
      await apiPut("/api/users/me", { display_name: newUsername });
      const refreshedProfile = await fetchUserProfile();
      if (refreshedProfile) setUser(refreshedProfile);
      return true;
    } catch (err: any) {
      setAuthError(err.message || "Unexpected error updating username.");
      return false;
    }
  };

  const updateLocation = async (location: LocationData): Promise<boolean> => {
    if (!user) {
      setAuthError("Not authenticated.");
      return false;
    }

    try {
      await apiPut("/api/users/me", {
        country: location.country,
        state: location.state,
        city: location.city,
      });
      const refreshedProfile = await fetchUserProfile();
      if (refreshedProfile) setUser(refreshedProfile);
      return true;
    } catch (err: any) {
      setAuthError(err.message || "Unexpected error updating location.");
      return false;
    }
  };

  const walletLogin = async (
    identityKey: string,
    certificate: any,
    userData: any
  ): Promise<boolean> => {
    setAuthError(null);

    try {
      const data = await apiPost<{
        success: boolean;
        access_token: string;
        refresh_token: string;
        user: any;
        error?: string;
      }>("/api/auth/wallet-login", {
        identityKey,
        certificateSerialNumber: certificate.serialNumber,
        certificate,
        userData,
      }, { skipAuth: true });

      if (!data.success) {
        setAuthError(data.error || "Wallet authentication failed");
        return false;
      }

      // Store tokens
      setTokens(data.access_token, data.refresh_token);

      // Fetch full profile
      setProfileLoading(true);
      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        setIsAuthenticated(true);
      } else {
        // Use the user data from the login response as fallback
        setUser({
          id: data.user?.id || "",
          display_name: data.user?.display_name || userData.displayName || "Explorer",
          role: "contributor",
          email: null,
          country: null,
          state: null,
          city: null,
        });
        setIsAuthenticated(true);
      }
      setProfileLoading(false);

      return true;
    } catch (err: any) {
      console.error("Wallet login error:", err);
      setAuthError(err.message || "Unexpected error during wallet login");
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isLoading,
        profileLoading,
        authError,
        login,
        logout,
        register,
        updateUsername,
        updateLocation,
        walletLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
