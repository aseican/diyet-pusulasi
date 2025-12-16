import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { useToast } from "@/components/ui/use-toast";
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ Native (Android/iOS) OAuth dönüşünü yakala (kullanmıyorsan bile zararsız)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = App.addListener("appUrlOpen", async ({ url }) => {
      try {
        // Supabase OAuth (PKCE) dönüşü genelde ?code=... ile gelir (ileride Apple vs. eklenirse işe yarar)
        if (url && url.includes("code=")) {
          await supabase.auth.exchangeCodeForSession(url);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        // Tarayıcıyı kapat (açıksa)
        try {
          await Browser.close();
        } catch {}
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Giriş tamamlanamadı",
          description: e?.message || "Lütfen tekrar deneyin.",
        });
      }
    });

    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, [toast]);

  const signUp = useCallback(
    async (email, password) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Kayıt Başarısız",
          description: error.message || "Bir şeyler ters gitti.",
        });
      }
      return { error };
    },
    [toast]
  );

  const signIn = useCallback(async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // burada toast YOK -> UI metnini AuthScreen kontrol edecek
  return { error };
}, []);



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

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
    }),
    [user, session, loading, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
