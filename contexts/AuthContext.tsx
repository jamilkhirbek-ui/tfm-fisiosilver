
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { logUserAction } from '../services/dbService';

interface User {
    uid: string;
    email: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ uid: string } | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true,
    signIn: async () => {},
    signUp: async () => null,
    signOut: async () => {} 
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserIsActive = async (userId: string) => {
    if (!isSupabaseConfigured) return true;
    try {
      const { data, error } = await supabase.from('users').select('active').eq('id', userId).maybeSingle();
      if (error) return true;
      return data?.active ?? true;
    } catch {
      return true;
    }
  };

  useEffect(() => {
    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const isActive = await ensureUserIsActive(session.user.id);
                if (!isActive) {
                    await supabase.auth.signOut();
                    setUser(null);
                } else {
                    setUser({ uid: session.user.id, email: session.user.email || null });
                }
            }
        } catch (e) {
            console.error("Supabase auth check failed:", e);
        } finally {
            setLoading(false);
        }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        ensureUserIsActive(session.user.id).then((isActive) => {
          if (!isActive) {
            supabase.auth.signOut();
            setUser(null);
            return;
          }
          setUser({ uid: session.user.id, email: session.user.email || null });
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
      if (!password) throw new Error("Se requiere contraseña.");
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
          const isActive = await ensureUserIsActive(data.user.id);
          if (!isActive) {
              await supabase.auth.signOut();
              throw new Error("Tu cuenta esta inactiva. Contacta con el administrador.");
          }
          await logUserAction(data.user.id, 'login', 'Inicio de sesion correcto.');
      }
  };

  const signUp = async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
              emailRedirectTo: window.location.origin
          }
      });
      if (error) throw error;
      return data.user ? { uid: data.user.id } : null;
  };

  const signOut = async () => {
      if (user?.uid) {
          await logUserAction(user.uid, 'logout', 'Cierre de sesion.');
      }
      await supabase.auth.signOut();
      setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
