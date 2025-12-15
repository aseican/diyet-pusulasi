import React, { useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "./ui/use-toast";

/**
 * Premium, doğru Google "G" (tek path, düzgün render)
 */
const GoogleG = (props) => (
  <svg
    className="mr-2 h-4 w-4"
    viewBox="0 0 48 48"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303C33.972 32.658 29.41 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.924 6.053 29.698 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.651-.389-3.917z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 19.02 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.924 6.053 29.698 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.305 0 10.268-2.02 13.962-5.304l-6.441-5.293C29.534 35.91 26.892 37 24 37c-5.387 0-9.936-3.323-11.274-7.946l-6.52 5.02C9.507 40.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303a12.03 12.03 0 0 1-4.2 5.403l.003-.002 6.441 5.293C36.999 39.2 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"
    />
  </svg>
);

const AuthScreen = () => {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (!error) {
          toast({
            title: "Kayıt Başarılı 🎉",
            description: "Lütfen e-posta adresinize gönderilen onay linkine tıklayın.",
          });
          setEmail("");
          setPassword("");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Giriş başarısız",
            description: error.message || "Lütfen bilgilerinizi kontrol edin.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google ile giriş (prod redirect düzgün + UX temiz)
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Supabase URL Configuration: https://diyettakip.org ve /auth/callback zaten allow-list’te ✅
      // Bu redirectTo iOS/Android/Web’de token URL çirkinliğini de çözer.
      const { error } = await signInWithGoogle({
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) {
        toast({
          title: "Google ile giriş başarısız",
          description: error.message || "Lütfen tekrar deneyin.",
          variant: "destructive",
        });
        setGoogleLoading(false);
      }
      // Başarılıysa zaten sayfa Google’a yönlenecek; burada setGoogleLoading(false) gerekmez.
    } catch (e) {
      toast({
        title: "Google ile giriş başarısız",
        description: e?.message || "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-full shadow-md mb-4">
            <img
              src="https://i.hizliresim.com/psoyqy3.png"
              alt="Diyet Pusulası Logo"
              className="w-14 h-14"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Diyet Pusulası</h1>
          <p className="text-gray-600 mt-2">Sağlıklı yaşama adım atın 💪</p>
        </div>

        <Tabs
          defaultValue="signin"
          className="w-full"
          onValueChange={(val) => setIsSignUp(val === "signup")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Giriş Yap</TabsTrigger>
            <TabsTrigger value="signup">Kayıt Ol</TabsTrigger>
          </TabsList>

          {/* Premium Google Button (UI layout aynı, sadece daha şık + sağlam) */}
          <div className="p-4 bg-white rounded-t-lg shadow-lg border-b border-gray-200">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full bg-white text-gray-800 border border-gray-300 shadow-sm hover:bg-gray-50"
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleG />
              )}
              Google ile giriş yap
            </Button>
          </div>

          {/* Ayırıcı */}
          <div className="relative bg-white shadow-lg">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Veya</span>
            </div>
          </div>

          {/* E-posta/Şifre Formu */}
          <form onSubmit={handleAuth}>
            <TabsContent
              value={isSignUp ? "signup" : "signin"}
              className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg"
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading
                  ? isSignUp
                    ? "Kayıt olunuyor..."
                    : "Giriş yapılıyor..."
                  : isSignUp
                  ? "Kayıt Ol"
                  : "Giriş Yap"}
              </Button>
            </TabsContent>
          </form>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthScreen;
