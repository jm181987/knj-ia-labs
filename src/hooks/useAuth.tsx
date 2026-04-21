import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Setup listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      if (sess?.user) {
        // Defer role check to avoid deadlock
        setTimeout(async () => {
          try {
            const { data } = await (supabase as any)
              .from("user_roles")
              .select("role")
              .eq("user_id", sess.user.id)
              .eq("role", "admin")
              .maybeSingle();
            if (mounted) setIsAdmin(!!data);
          } catch (e) {
            console.warn("role check failed", e);
            if (mounted) setIsAdmin(false);
          }
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    // THEN check existing session
    supabase.auth.getSession()
      .then(({ data: { session: sess } }) => {
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
      })
      .catch((e) => console.warn("getSession failed", e))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Safety net: never stay loading more than 5s
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
