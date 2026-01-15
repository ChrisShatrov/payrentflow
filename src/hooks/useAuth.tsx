import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'tenant' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  signUp: (email: string, password: string, fullName: string, phone: string, role: string) => Promise<{ data?: any; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[useAuth] Fetching role for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      console.log('[useAuth] Role fetch result:', { data, error });

      if (data?.role) {
        console.log('[useAuth] Setting role to:', data.role);
        setRole(data.role as UserRole);
      } else {
        console.warn('[useAuth] No role found for user:', userId);
        // Check if user is assigned to a unit - if so, default to tenant
        const { data: unitData } = await supabase
          .from('units')
          .select('id')
          .eq('tenant_id', userId)
          .maybeSingle();
        
        if (unitData) {
          console.log('[useAuth] User is assigned to a unit, defaulting to tenant role');
          setRole('tenant');
        } else {
          // Check if user owns any properties - if so, default to admin
          const { data: propertyData } = await supabase
            .from('properties')
            .select('id')
            .eq('landlord_id', userId)
            .maybeSingle();
          
          if (propertyData) {
            console.log('[useAuth] User owns properties, defaulting to admin role');
            setRole('admin');
          } else {
            // No role and no unit/property assignment - set to null but allow login
            console.warn('[useAuth] No role, unit, or property found - user can still log in');
            setRole(null);
          }
        }
      }
    } catch (error) {
      console.error('[useAuth] Error fetching user role:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if this is a password recovery session
    const isRecoverySession = () => {
      // Check URL hash for recovery token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");
      if (type === "recovery") {
        return true;
      }
      // Check URL search params (for redirects from Supabase)
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("type") === "recovery") {
        return true;
      }
      return false;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth state changed:', event, session?.user?.id);
        
        // If this is a recovery session, don't fetch role (prevents redirects)
        if (isRecoverySession() && event === "PASSWORD_RECOVERY") {
          console.log('[useAuth] Recovery session detected, skipping role fetch');
          setSession(session);
          setUser(session?.user ?? null);
          setRole(null); // Keep role null during recovery
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch role immediately when session changes
        if (session?.user) {
          fetchUserRole(session.user.id);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] Initial session check:', session?.user?.id);
      
      // If we just signed out, ignore any restored session
      const justSignedOut = localStorage.getItem('just_signed_out');
      if (justSignedOut) {
        console.log('[useAuth] Just signed out, ignoring restored session');
        localStorage.removeItem('just_signed_out');
        setSession(null);
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string, role: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
          role: role,
        },
      },
    });
    
    return { data, error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear inactivity tracking
    localStorage.removeItem('last_activity_timestamp');
    
    // Clear Supabase session from localStorage directly
    // Supabase stores session data with keys like 'sb-<project-ref>-auth-token'
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') && key.includes('auth-token')
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear local state
    setUser(null);
    setSession(null);
    setRole(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
