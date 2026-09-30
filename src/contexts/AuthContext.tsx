// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiPost,
  apiGet,
  apiPut,
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
} from "@/lib/api";
import type { AuthProof } from "@/lib/authProof";
import { DEV_AUTH_ENABLED, makeDevUser } from "@/lib/devAuth";
import { useWallet } from "@/contexts/WalletContext";
import { findLoginCertificate } from "@/lib/certConfig";
import { getDataFromWallet } from "@/utils/getDataFromWallet";
import { createAuthProof } from "@/lib/authProof";
import { applyDisplayNameChange, BRIXIT_CERTIFIER_KEY } from "@/lib/brixitCert";

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
  updateUsername: (newUsername: string) => Promise<{ success: boolean; error?: string }>;
  updateLocation: (location: LocationData) => Promise<boolean>;
  walletLogin: (identityKey: string, certificate: unknown, userData: unknown, proof: AuthProof) => Promise<{ success: boolean; error?: string }>;
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
  const queryClient = useQueryClient();
  // WalletProvider wraps AuthProvider, so the wallet is available here.
  const { userWallet, userPubKey } = useWallet();

  // With the DEV bypass on, start already-authenticated and skip both loading
  // gates so ProtectedRoute renders immediately instead of waiting on a
  // refresh call that cannot succeed without a backend.
  const [user, setUser] = useState<UserProfile | null>(
    DEV_AUTH_ENABLED ? makeDevUser() : null
  );
  const [isAuthenticated, setIsAuthenticated] = useState(DEV_AUTH_ENABLED);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!DEV_AUTH_ENABLED);
  const [profileLoading, setProfileLoading] = useState(!DEV_AUTH_ENABLED);

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
    if (DEV_AUTH_ENABLED) {
      console.info(
        "[AuthContext] DEV auth bypass active: session is mocked, API calls still hit the real backend."
      );
      return;
    }
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
      // Nothing to revoke server-side when the session is mocked.
      if (!DEV_AUTH_ENABLED) {
        // Backend clears the HttpOnly refresh token cookie
        await apiPost("/api/auth/logout", {}).catch(() => {});
      }
    } finally {
      clearAccessToken();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      // Cached submission pages carry the outgoing user's private photo keys,
      // and the presigned-URL cache carries live links. Without this they would
      // survive into whoever signs in next on this tab.
      queryClient.clear();
    }
  };

  // The name lives on the certificate as well as in the database, and login
  // copies the certificate over the database — so a rename has to update both.
  const updateUsername = async (
    newUsername: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      setAuthError("Not authenticated.");
      return { success: false };
    }

    if (DEV_AUTH_ENABLED) {
      setUser({ ...user, display_name: newUsername });
      return { success: true };
    }

    try {
      await applyDisplayNameChange({
        currentDisplayName: user.display_name,
        newDisplayName: newUsername,
        wallet: userWallet as never,
        certifier: BRIXIT_CERTIFIER_KEY,
        loadCurrentCert: async () => {
          const cert = await findLoginCertificate(userWallet as never);
          if (!cert) return null;
          const data = await getDataFromWallet(userWallet, cert);
          return { cert, email: data?.email };
        },
        persistToDb: async (displayName) => {
          await apiPut("/api/users/me", { display_name: displayName });
        },
        // Re-issuing invalidates the stored serial; logging in again repoints it.
        reLogin: async () => {
          const cert = await findLoginCertificate(userWallet as never);
          const data = cert ? await getDataFromWallet(userWallet, cert) : null;
          if (!cert || !data || !userPubKey) return;
          const proof = await createAuthProof(userWallet as never, BRIXIT_CERTIFIER_KEY, "login");
          await walletLogin(userPubKey, cert, data, proof);
        },
      });

      const refreshedProfile = await fetchUserProfile();
      if (refreshedProfile) setUser(refreshedProfile);
      return { success: true };
    } catch (err: unknown) {
      // Surface failures as a local form error in the caller, NOT the global
      // authError — that makes ProtectedRoute eject the user to the login page
      // on any transient write failure.
      const message = err instanceof Error ? err.message : String(err);
      console.error("[updateUsername]", message);
      return {
        success: false,
        ...(message === "WALLET_REQUIRED" && {
          error: "Connect your wallet to change your name.",
        }),
      };
    }
  };

  const updateLocation = async (location: LocationData): Promise<boolean> => {
    if (!user) {
      setAuthError("Not authenticated.");
      return false;
    }

    if (DEV_AUTH_ENABLED) {
      setUser({ ...user, ...location });
      return true;
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
      console.error("[updateLocation]", err instanceof Error ? err.message : err);
      return false;
    }
  };

  const walletLogin = async (
    identityKey: string,
    certificate: unknown,
    userData: unknown,
    proof: AuthProof
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
        proof,
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
