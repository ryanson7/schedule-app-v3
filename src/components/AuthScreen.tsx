// src/components/AuthScreen.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import LoginPage from '../pages/auth/login';

export default function AuthScreen({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return subscription.unsubscribe;
  }, []);

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return children;
}
