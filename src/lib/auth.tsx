import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "mentor" | "client";
interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: Role[];
  hasRole: (r: Role) => boolean;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRoles(uid: string | undefined) {
    if (!uid) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadRoles(s?.user.id), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadRoles(data.session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        roles,
        hasRole: (r) => roles.includes(r),
        refreshRoles: () => loadRoles(session?.user.id),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
