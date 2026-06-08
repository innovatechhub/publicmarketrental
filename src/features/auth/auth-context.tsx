import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAppUser, resolveAppUserFromAuth } from "@/integrations/supabase/auth-service";
import { supabase } from "@/integrations/supabase/client";
import type { AppUser } from "@/types/domain";

interface SignInInput {
  email: string;
  password: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  businessName: string;
  phone: string;
  address: string;
}

interface RegisterResult {
  user: AppUser | null;
  requiresEmailConfirmation: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  signIn: (input: SignInInput) => Promise<AppUser>;
  signOut: () => Promise<void>;
  registerVendor: (input: RegisterInput) => Promise<RegisterResult>;
  updateProfile: (
    input: Partial<Pick<AppUser, "name" | "email" | "phone" | "businessName">>,
  ) => Promise<AppUser>;
  changeEmail: (nextEmail: string) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }

  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!supabase) {
        if (isMounted) {
          setUser(null);
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        await withTimeout(
          (async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!isMounted) {
              return;
            }

            if (session?.user) {
              try {
                setUser(await resolveAppUserFromAuth(session.user));
              } catch {
                setUser(null);
              }
            } else {
              setUser(null);
            }
          })(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
        );
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!isMounted) {
          return;
        }

        if (session?.user) {
          try {
            setUser(await resolveAppUserFromAuth(session.user));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }

        setIsBootstrapping(false);
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      async signIn({ email, password }) {
        const db = requireSupabase();

        const { data, error } = await db.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.user) {
          throw new Error("Sign in did not return a user session.");
        }

        const nextUser = await resolveAppUserFromAuth(data.user);
        setUser(nextUser);
        return nextUser;
      },
      async registerVendor({ name, email, password, businessName, phone, address }) {
        const db = requireSupabase();

        const { data, error } = await db.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: name,
              phone,
              role: "vendor",
              business_name: businessName,
              business_type: "",
              address,
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.user) {
          throw new Error("Vendor registration did not return an account.");
        }

        if (!data.session) {
          return {
            user: null,
            requiresEmailConfirmation: true,
          };
        }

        const nextUser = await resolveAppUserFromAuth(data.user);
        setUser(nextUser);

        return {
          user: nextUser,
          requiresEmailConfirmation: false,
        };
      },
      async signOut() {
        const db = requireSupabase();
        const { error } = await db.auth.signOut();

        if (error) {
          throw new Error(error.message);
        }

        setUser(null);
      },
      async updateProfile(input) {
        const activeUser = user;

        if (!activeUser) {
          throw new Error("No active user session.");
        }

        const db = requireSupabase();
        const { error: profileError } = await db
          .from("profiles")
          .update({
            full_name: input.name ?? activeUser.name,
            email: input.email?.trim().toLowerCase() ?? activeUser.email,
            phone: input.phone ?? activeUser.phone,
          })
          .eq("id", activeUser.id);

        if (profileError) {
          throw profileError;
        }

        if (activeUser.role === "vendor") {
          const { error: vendorError } = await db
            .from("vendors")
            .update({
              business_name: input.businessName ?? activeUser.businessName ?? "",
            })
            .eq("profile_id", activeUser.id);

          if (vendorError) {
            throw vendorError;
          }
        }

        const nextUser = await fetchAppUser(activeUser.id);
        setUser(nextUser);
        return nextUser;
      },
      async requestPasswordReset(email) {
        const db = requireSupabase();

        const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/login`,
        });

        if (error) {
          throw new Error(error.message);
        }
      },
      async changeEmail(nextEmail) {
        const activeUser = user;

        if (!activeUser) {
          throw new Error("No active user session.");
        }

        const db = requireSupabase();
        const normalizedEmail = nextEmail.trim().toLowerCase();

        if (!normalizedEmail) {
          throw new Error("Email is required.");
        }

        if (normalizedEmail === activeUser.email) {
          throw new Error("This is already your current email.");
        }

        const { error: authError } = await db.auth.updateUser({ email: normalizedEmail });

        if (authError) {
          throw new Error(authError.message);
        }

        const { error: profileError } = await db
          .from("profiles")
          .update({ email: normalizedEmail })
          .eq("id", activeUser.id);

        if (profileError) {
          throw profileError;
        }

        const nextUser = await fetchAppUser(activeUser.id);
        setUser(nextUser);
      },
      async changePassword(currentPassword, nextPassword) {
        const activeUser = user;

        if (!activeUser) {
          throw new Error("No active user session.");
        }

        const db = requireSupabase();
        const current = currentPassword.trim();
        const next = nextPassword.trim();

        if (!current || !next) {
          throw new Error("Current and new passwords are required.");
        }

        if (current === next) {
          throw new Error("New password must be different from your current password.");
        }

        const { error: reauthError } = await db.auth.signInWithPassword({
          email: activeUser.email,
          password: current,
        });

        if (reauthError) {
          throw new Error("Current password is incorrect.");
        }

        const { error: passwordError } = await db.auth.updateUser({ password: next });

        if (passwordError) {
          throw new Error(passwordError.message);
        }
      },
    }),
    [isBootstrapping, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Authentication bootstrap timed out.")), ms);
    }),
  ]);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
