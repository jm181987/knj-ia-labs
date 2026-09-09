import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppSession, AppUser } from "@/integrations/backend/client";

interface AuthContextValue {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    let checkId = 0;

    const applySession = async (sess: AppSession | null) => {
      const currentCheck = ++checkId;
      if (!mounted) return;
      setLoading(true);
      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", sess.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (error) throw error;
        if (mounted && currentCheck === checkId) setIsAdmin(!!data);
      } catch (e) {
        console.warn("role check failed", e);
        if (mounted && currentCheck === checkId) setIsAdmin(false);
      } finally {
        if (mounted && currentCheck === checkId) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setTimeout(() => { void applySession(sess); }, 0);
    });

    supabase.auth.getSession()
      .then(({ data: { session: sess } }) => applySession(sess))
      .catch((e) => {
        console.warn("getSession failed", e);
        if (mounted) setLoading(false);
      });

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
