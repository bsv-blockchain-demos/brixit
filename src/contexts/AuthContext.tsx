// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

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
  resetPassword: (email: string) => Promise<boolean>;
  sendPasswordResetOTP: (email: string) => Promise<boolean>;
  resetPasswordWithOTP: (email: string, token: string, password: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  handleAuthCallback: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Never derive a name from email for display purposes.
// Use profile.display_name first, then user_metadata, else a neutral default.
function deriveDisplayName(sessionUser?: { email?: string | null; user_metadata?: Record<string, any> } | null): string {
  if (!sessionUser) return "Explorer";
  const meta = sessionUser.user_metadata || {};
  const fromMeta =
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    meta.username;
  if (typeof fromMeta === "string" && fromMeta.trim().length > 0) {
    return fromMeta.trim();
  }
  // Do NOT use email prefix (to avoid showing email)
  return "Explorer";
}

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    if (!userId) return null;

    // Fetch user profile from users table (email was removed from this table)
    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .select(
        "id, display_name, points, submission_count, last_submission, country, state, city"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[fetchUserProfile] Supabase error:", profileError.message);
      return null;
    }

    if (!profileData) {
      return null;
    }

    // Fetch user roles from user_roles table
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("[fetchUserProfile] Error fetching roles:", rolesError.message);
    }

    // Determine highest role (admin > contributor > user)
    let userRole = "user";
    if (rolesData && rolesData.length > 0) {
      if (rolesData.some((r) => r.role === "admin")) {
        userRole = "admin";
      } else if (rolesData.some((r) => r.role === "contributor")) {
        userRole = "contributor";
      }
    }

    return {
      ...profileData,
      role: userRole,
    } as UserProfile;
  } catch (err: any) {
    console.error("[fetchUserProfile] Unexpected error:", err.message || err);
    return null;
  }
}

async function ensureProfileExists(userId: string, retries = 3): Promise<UserProfile | null> {
  for (let i = 0; i < retries; i++) {
    const profile = await fetchUserProfile(userId);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
  }
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // session loading
  const [profileLoading, setProfileLoading] = useState(true); // profile loading

  const isAdmin = user?.role === "admin";

  // Synchronous-only handler to avoid deadlocks inside onAuthStateChange
  const handleSessionChange = (session: any) => {
    const sessionUser = session?.user ?? null;
    if (sessionUser) {
      const { id, email } = sessionUser;

      setIsAuthenticated(true);
      setAuthError(null);
      setProfileLoading(true);

      // Set minimal, safe profile immediately (no email-derived display names)
      const minimalProfile: UserProfile = {
        id,
        display_name: deriveDisplayName(sessionUser),
        role: "contributor",
        email: email || null,
        country: null,
        state: null,
        city: null,
        points: 0,
        submission_count: 0,
      };
      setUser(minimalProfile);

      // Defer profile fetching to avoid deadlock
      setTimeout(() => {
        fetchAndUpdateProfile(id, email || null, sessionUser);
      }, 0);
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setProfileLoading(false);
    }
  };

  // Async profile fetching - called after state updates
  const fetchAndUpdateProfile = async (
    userId: string,
    email: string | null,
    sessionUser: any
  ) => {
    try {
      const profile = await ensureProfileExists(userId);
      if (profile) {
        // If display_name is missing, derive a safe one from metadata (not email)
        const safeName =
          (profile.display_name && profile.display_name.trim().length > 0)
            ? profile.display_name
            : deriveDisplayName(sessionUser);

        setUser({
          ...profile,
          display_name: safeName,
          email: email,
        });
      } else {
        console.warn("User profile not found, keeping minimal profile");
      }
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      // Keep the minimal profile that was already set
    } finally {
      setProfileLoading(false);
    }
  };

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setAuthError(error.message);
        return;
      }

      handleSessionChange(session);
    } catch (err: any) {
      setAuthError("Unexpected error loading session.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST - synchronous callbacks only
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleSessionChange(session);
    });

    // THEN check for existing session
    loadSession();

    return () => subscription.unsubscribe();
  }, []);

  const register = async (
    email: string,
    password: string,
    displayName: string,
    location?: LocationData
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      const userMetadata: any = {
        display_name: displayName.trim() || "Explorer",
        ...location,
      };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        console.error("Signup error:", { error, code: error.status });

        let userFriendlyMessage = error.message;
        if (error.status === 422) {
          userFriendlyMessage =
            "Unable to create account. Please try again in a few moments.";
        } else if (
          error.message.includes("Password should be at least 8 characters") ||
          error.message.includes("Password should be at least 6 characters")
        ) {
          userFriendlyMessage = "Password must be at least 8 characters long.";
        } else if (error.message.includes("Password should contain at least one uppercase")) {
          userFriendlyMessage = "Password must contain at least one uppercase letter.";
        } else if (error.message.includes("Password should contain at least one lowercase")) {
          userFriendlyMessage = "Password must contain at least one lowercase letter.";
        } else if (error.message.includes("Password should contain at least one number")) {
          userFriendlyMessage = "Password must contain at least one number.";
        } else if (error.message.includes("Password should contain at least one special character")) {
          userFriendlyMessage = "Password must contain at least one special character.";
        }

        setAuthError(userFriendlyMessage);
        return false;
      }

      if (data.user) return true;

      setAuthError("Signup failed. No user returned.");
      return false;
    } catch (err: any) {
      setAuthError("Unexpected error during signup.");
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error.message);
        setAuthError(error.message);
        return false;
      }

      if (data.user) return true;

      setAuthError("Login failed. No user returned.");
      return false;
    } catch (err: any) {
      setAuthError("Unexpected error during login.");
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setAuthError(error.message);
    } catch (err: any) {
      setAuthError("Unexpected error during logout.");
    } finally {
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
      const { error } = await supabase
        .from("users")
        .update({ display_name: newUsername })
        .eq("id", user.id);

      if (error) {
        setAuthError(error.message);
        return false;
      }

      const refreshedProfile = await fetchUserProfile(user.id);
      if (refreshedProfile) {
        setUser({ ...refreshedProfile, email: user.email });
      }
      return true;
    } catch (err: any) {
      setAuthError("Unexpected error updating username.");
      return false;
    }
  };

  const updateLocation = async (location: LocationData): Promise<boolean> => {
    if (!user) {
      setAuthError("Not authenticated.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({
          country: location.country,
          state: location.state,
          city: location.city,
        })
        .eq("id", user.id);

      if (error) {
        setAuthError(error.message);
        return false;
      }

      const refreshedProfile = await fetchUserProfile(user.id);
      if (refreshedProfile) {
        setUser({ ...refreshedProfile, email: user.email });
      }
      return true;
    } catch (err: any) {
      setAuthError("Unexpected error updating location.");
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setAuthError("Failed to send password reset email");
      return false;
    }
  };

  const sendPasswordResetOTP = async (email: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password-otp`,
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setAuthError("Failed to send password reset code");
      return false;
    }
  };

  const resetPasswordWithOTP = async (
    email: string,
    token: string,
    password: string
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });

      if (error) {
        if (error.message.includes("Token has expired")) {
          setAuthError("The reset code has expired. Please request a new one.");
        } else {
          setAuthError(error.message);
        }
        return false;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setAuthError(updateError.message);
        return false;
      }

      return true;
    } catch (err: any) {
      setAuthError("Failed to reset password");
      return false;
    }
  };

  const updatePassword = async (password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setAuthError("Failed to update password");
      return false;
    }
  };

  const handleAuthCallback = async (): Promise<boolean> => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        setAuthError(error.message);
        return false;
      }
      handleSessionChange(session);
      return true;
    } catch (err: any) {
      setAuthError("Failed to handle auth callback");
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
        resetPassword,
        sendPasswordResetOTP,
        resetPasswordWithOTP,
        updatePassword,
        handleAuthCallback,
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
