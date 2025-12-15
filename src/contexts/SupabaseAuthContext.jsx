import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";


const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            emailRedirectTo: window.location.origin,
        },
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Kayıt Başarısız",
        description: error.message || "Bir şeyler ters gitti.",
      });
    }
    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({
        variant: "destructive",
        title: "Giriş Başarısız",
        description: error.message || "E-posta veya şifre hatalı.",
      });
    }
    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Çıkış Başarısız",
        description: error.message || "Bir şeyler ters gitti.",
      });
    }
    return { error };
  }, [toast]);

  // --- YENİ EKLENEN FONKSİYON ---
 const signInWithGoogle = useCallback(async (options = {}) => {
  try {
    const redirectTo =
      options.redirectTo ?? `${window.location.origin}/auth/callback`;

    // ✅ Native (Android/iOS) ise: Google login'i sistem tarayıcısında aç
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true, // ✅ URL'yi biz açacağız
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned");

      // App geri dönünce Supabase session otomatik yakalansın diye:
      // (Sen zaten onAuthStateChange ile session’ı alıyorsun)
      await Browser.open({ url: data.url });

      return { error: null };
    }

    // ✅ Web ise: normal redirect akışı
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) throw error;
    return { error: null };
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Google ile Giriş Başarısız",
      description: error.message || "Bir şeyler ters gitti.",
    });
    return { error };
  }
}, [toast]);

  // --- YENİ FONKSİYON BİTİŞİ ---


  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle, // <-- BURAYA EKLENDİ
  }), [user, session, loading, signUp, signIn, signOut, signInWithGoogle]); // <-- BURAYA EKLENDİ

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};