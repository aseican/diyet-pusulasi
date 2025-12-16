import React, { useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "./ui/use-toast";

const AuthScreen = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
  description: "Hesabın oluşturuldu. Şimdi giriş yapabilirsin.",
});

          setEmail("");
          setPassword("");
        }
      } else {
        const { error } = await signIn(email, password);
if (error) {
  toast({
    title: "Giriş başarısız",
    description: "E-posta veya şifre yanlış.",
    variant: "destructive",
  });
}

      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-full shadow-md mb-4">
            <img
  src="/logo.png"
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
