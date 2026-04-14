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
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
} from "@/lib/api";

interface UserProfile {
  id: string;
  display_name: string | null;
  identity_key?: string | null;
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
  walletLogin: (identityKey: string, certificate: unknown, userData: unknown, nonce: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await apiGet<{
      id: string;
      email: string | null;
      display_name: string | null;
      identity_key: string | null;
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
      identity_key: data.identity_key,
      role: userRole,
      email: data.email,
      country: data.country,
      state: data.state,
      city: data.city,
      points: data.points,
      submission_count: data.submission_count,
      last_submission: data.last_submission,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetchUserProfile] Error:", message);
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const isAdmin = user?.role === "admin";

  // On mount, attempt a silent token refresh using the HttpOnly cookie.
  // If the cookie is present and valid, the backend returns a fresh access
  // token and we can restore the session without any user interaction.
  const loadSession = async () => {
    setIsLoading(true);
    setProfileLoading(true);
    try {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        clearAccessToken();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error loading session:", message);
      clearAccessToken();
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

  // Email/password auth stubs — wallet-only auth, kept for interface compat
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
      // Backend clears the HttpOnly refresh token cookie
      await apiPost("/api/auth/logout", {}).catch(() => {});
    } finally {
      clearAccessToken();
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error updating username.";
      setAuthError(message);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error updating location.";
      setAuthError(message);
      return false;
    }
  };

  const walletLogin = async (
    identityKey: string,
    certificate: unknown,
    userData: unknown,
    nonce: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);

    try {
      const data = await apiPost<{
        success: boolean;
        access_token: string;
        user: { id: string; display_name: string; roles: string[] };
        error?: string;
      }>("/api/auth/wallet-login", {
        identityKey,
        certificateSerialNumber: (certificate as { serialNumber: string }).serialNumber,
        certificate,
        userData,
        nonce,
      }, { skipAuth: true });

      if (!data.success) {
        const error = data.error || "Wallet authentication failed";
        setAuthError(error);
        return { success: false, error };
      }

      // Store access token in memory; refresh token is in the HttpOnly cookie set by the backend
      setAccessToken(data.access_token);

      setProfileLoading(true);
      const profile = await fetchUserProfile();
      if (profile) {
        setUser(profile);
        setIsAuthenticated(true);
      } else {
        // Fallback to data from login response
        setUser({
          id: data.user?.id || "",
          display_name: data.user?.display_name || (userData as { displayName?: string }).displayName || "Explorer",
          role: "contributor",
          email: null,
          country: null,
          state: null,
          city: null,
        });
        setIsAuthenticated(true);
      }
      setProfileLoading(false);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error during wallet login";
      console.error("Wallet login error:", message);
      setAuthError(message);
      return { success: false, error: message };
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
