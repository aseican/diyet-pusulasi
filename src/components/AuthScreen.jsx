import React, { useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';

// Renkli Google "G" Logosu
const ColorfulGoogleIcon = props => <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" {...props}>
    <path fill="#4285F4" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C290.7 96.5 271.5 84 248 84c-52 0-94.3 43.4-94.3 97.4s42.3 97.4 94.3 97.4c59.3 0 83.4-39.7 86.6-60.7H248v-85.3h236.1c2.3 12.7 3.9 26.4 3.9 41.7z"></path>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-2.06.86-2.4 0-4.43-1.6-5.16-3.75H.9v2.3C2.4 16.4 5.48 18 9 18z"></path>
    <path fill="#FBBC05" d="M3.84 10.73c-.2-.54-.3-.1.3-1.64s.1-.1.3-1.64V5.03H.9c-.8 1.6-1.2 3.4-1.2 5.3s.4 3.7 1.2 5.3l2.94-2.3z"></path>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.47.8 11.43 0 9 0 5.48 0 2.4 1.6 1.04 4.1L3.84 6.4c.73-2.15 2.76-3.75 5.16-3.75z"></path>
  </svg>;
const AuthScreen = () => {
  const {
    signIn,
    signUp,
    signInWithGoogle
  } = useAuth();
  const {
    toast
  } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // E-posta/Şifre ile giriş
  const handleAuth = async e => {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const {
        error
      } = await signUp(email, password);
      if (!error) {
        toast({
          title: 'Kayıt Başarılı 🎉',
          description: 'Lütfen e-posta adresinize gönderilen onay linkine tıklayın.'
        });
        setEmail('');
        setPassword('');
      }
    } else {
      await signIn(email, password);
    }
    setLoading(false);
  };

  // Google ile giriş
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
  };
  return <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-white rounded-full shadow-md mb-4">
            <img src="https://i.hizliresim.com/psoyqy3.png" alt="Diyet Pusulası Logo" className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Diyet Pusulası</h1>
          <p className="text-gray-600 mt-2">Sağlıklı yaşama adım atın 💪</p>
        </div>

        <Tabs defaultValue="signin" className="w-full" onValueChange={val => setIsSignUp(val === 'signup')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Giriş Yap</TabsTrigger>
            <TabsTrigger value="signup">Kayıt Ol</TabsTrigger>
          </TabsList>

          {/* === GÜNCELLENMİŞ ŞIK GOOGLE BUTONU === */}
          <div className="p-4 bg-white rounded-t-lg shadow-lg border-b border-gray-200">
            <Button variant="default" // "outline" DEĞİL
          // Google stili için Tailwind sınıfları:
          // Beyaz arka plan, koyu gri metin, ince gri çerçeve ve hafif gölge
          className="w-full bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50" onClick={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ColorfulGoogleIcon /> // Renkli ikonu kullan
            }
              Google ile Devam Et
            </Button>
          </div>
          {/* === DEĞİŞİKLİK BİTTİ === */}


          {/* Ayırıcı */}
          <div className="relative bg-white shadow-lg">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Veya</span>
            </div>
          </div>
            
          {/* E-posta/Şifre Formu */}
          <form onSubmit={handleAuth}>
            <TabsContent value={isSignUp ? "signup" : "signin"} className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@mail.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? isSignUp ? 'Kayıt olunuyor...' : 'Giriş yapılıyor...' : isSignUp ? 'Kayıt Ol' : 'Giriş Yap'}
              </Button>
            </TabsContent>
          </form>
        </Tabs>
      </div>
    </div>;
};
export default AuthScreen;