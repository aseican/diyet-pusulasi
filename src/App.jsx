import React, { useRef } from 'react'; // useRef eklendi
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateCalorieTarget } from '@/lib/calculator';

// YENİ IMPORT: WebView'dan gelen mesajları dinlemek için
// Vercel build'ini geçmek için Vite.config.js'de dışladık, ancak
// bu satır tarayıcıda çalışırken hala hata verebilir.
import { WebView } from 'react-native-webview'; 

// YENİ IMPORT: Satın alma mantığı
import { handlePurchase } from '@/lib/BillingIntegration'; 

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Dashboard } from '@/components/Dashboard'; 
import { MealTracker } from '@/components/MealTracker'; 
import { Progress } from '@/components/Progress'; 
import Profile from '@/components/Profile';
import Onboarding from '@/components/Onboarding';
import AuthScreen from '@/components/AuthScreen';
import { PremiumUyelik } from '@/components/PremiumUyelik'; 


export function App() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [userData, setUserData] = React.useState(null); 
  const [meals, setMeals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  
  // 🛑 ÇÖZÜM İÇİN YENİ: Tarayıcıda çalışıyorsa WebView'u simüle eden boş bir bileşen kullan.
  // Bu, React Native Web/Browser ortamında çökmeyi engeller.
  const SafeWebView = (typeof document !== 'undefined' || !WebView) ? ({ children }) => <div style={{flex: 1, minHeight: 600, padding: 20}}>Tarayıcı Önizlemesinde Görüntülenemiyor. Lütfen Mobil Uygulamayı Kullanın.</div> : WebView;
  
  // YENİ REF: WebView komponentine erişmek için
  const webViewRef = useRef(null); 
  
  // YENİ SABİT: Web sitesinin ana URL'si
  const BASE_WEB_URL = 'https://diyettakip.org'; 
  
  // YENİ FONKSİYON: Supabase oturum token'ını alır.
  const getSupabaseSessionToken = React.useCallback(async () => {
    if (!user) return null;
    // Oturum token'ını çek
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, [user]);

  // YENİ FONKSİYON: WebView'dan gelen mesajları işler
  const onWebViewMessage = React.useCallback(async (event) => {
      // event.nativeEvent.data bir JSON dizesidir.
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'START_PURCHASE') {
          console.log("WebView'dan ödeme isteği alındı:", data.productId);
          
          // 🛑 DÜZELTME: Token'ı al ve handlePurchase'a gönder
          const token = await getSupabaseSessionToken();
          await handlePurchase(data.productId, webViewRef, updateUserData, toast, token);
      }
      
  }, [updateUserData, toast, getSupabaseSessionToken]); 
  // ===============================================

  // === FETCH USER DATA (Tek Satır Sorgu) ===
  const fetchUserData = React.useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,target_calories,created_at,gender,age,height,weight,target_weight,goal_type,activity_level,start_weight,water_intake,daily_water_goal,last_reset_date,plan_tier,ai_usage_count,premium_expires_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Profil yükleme hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Profil Hatası',
        description: 'Profiliniz yüklenirken bir hata oluştu.',
      });
    } else {
      setUserData(data);
    }
  }, [user, toast]);
  // ===========================================

  const fetchMeals = React.useCallback(async () => {
// ... (fetchMeals fonksiyonunun geri kalanı aynı)
    if (!user) return;
    const { data, error } = await supabase
      .from('added_meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Öğün ekleme hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Öğün Hatası',
        description: 'Öğünler yüklenirken bir hata oluştu.',
      });
    } else {
      setMeals(data);
    }
  }, [user, toast]);

  React.useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true);
        await Promise.all([fetchUserData(), fetchMeals()]);
        setLoading(false);
      } else {
        setUserData(null);
        setMeals([]);
        setLoading(false); 
      }
    };
    fetchData();
  }, [user, fetchUserData, fetchMeals]);

  // === MANTIK FIX 1: PROFIL GUNCELLEME (KALORI VE SU EKLEME HATASINI ÇÖZER) ===
  const updateUserData = React.useCallback(
// ... (updateUserData fonksiyonunun geri kalanı aynı)
    async (newData) => {
      if (!user) return;

      // 1. Yeni verileri mevcut verilerle birleştir
      const combinedData = { ...userData, ...newData };

      // 2. Yeni hedef kaloriyi hesapla
      const newTargetCalories = calculateCalorieTarget(combinedData);
      
      // 3. Payload'a yeni kalori hedefini ekle
      const payload = { ...newData, target_calories: newTargetCalories }; 

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Profil güncelleme hatası:', error);
        toast({
          variant: 'destructive',
          title: 'Güncelleme Hatası',
          description: 'Profiliniz güncellenirken bir hata oluştu.',
        });
      } else {
        setUserData(data);
        toast({ title: 'Başarılı!', description: 'Bilgileriniz güncellendi.' });
      }
    },
    [user, toast, userData]
  );

  // === MANTIK FIX 2: ONBOARDING TAMAMLAMA (BAŞLANGIÇ KİLOSU VE KALORİ HESAPLAMA) ===
  const handleOnboardingComplete = async (formData) => {
// ... (handleOnboardingComplete fonksiyonunun geri kalanı aynı)
    if (!user) return;
    
    // 1. Hesaplamalar
    const target_calories = calculateCalorieTarget(formData);
    const start_weight = formData.weight; // Başlangıç kilosu, ilk kilonuzdur

    // 2. Payload oluşturma
    const payload = { ...formData, id: user.id, target_calories, start_weight };

    const { data, error } = await supabase
      .from('profiles')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Profil kayıt hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Kayıt Hatası',
        description: 'Bilgiler kaydedilirken bir hata oluştu. RLS politikasını kontrol edin.',
      });
    } else {
      setUserData(data);
      toast({
        title: 'Hoş Geldin!',
        description: 'Profilin başarıyla oluşturuldu 💚',
      });
    }
  };

  const addMeal = async (mealData) => {
// ... (addMeal fonksiyonunun geri kalanı aynı)
    if (!user) return;
    const mealWithUser = { ...mealData, user_id: user.id };
    const { error } = await supabase.from('added_meals').insert([mealWithUser]);

    if (error) {
      console.error('Öğün ekleme hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Öğün eklenirken bir sorun oluştu.',
      });
    } else {
      fetchMeals();
    }
  };

  const deleteMeal = async (mealId) => {
// ... (deleteMeal fonksiyonunun geri kalanı aynı)
    if (!user) return;
    const { error } = await supabase
      .from('added_meals')
      .delete()
      .eq('id', mealId);

    if (error) {
      console.error('Öğün silme hatası:', error);
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Öğün silinirken bir sorun oluştu.',
      });
    } else {
      setMeals((prev) => prev.filter((m) => m.id !== mealId));
      toast({ title: 'Başarılı!', description: 'Öğün başarıyla silindi.' });
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!userData) {
    return (
      <>
        <Helmet>
          <title>Profil Oluştur - Diyet Takip</title>
        </Helmet>
        <div className="mobile-container">
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      </>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            userData={userData}
            meals={meals}
            updateUserData={updateUserData}
            deleteMeal={deleteMeal}
          />
        );
      case 'meals':
        return <MealTracker addMeal={addMeal} />;
      case 'progress':
        return <Progress userData={userData} />;
      case 'profile':
        return <Profile userData={userData} updateUserData={updateUserData} />;
      case 'premium': 
        // PREMIUM EKRANI İÇİN KOŞULLU RENDER KULLANILIR
          
          // 1. Web sitesinin ana URL'si
          const webUrl = BASE_WEB_URL; 
          
          // 2. Sadece Native (React Native) ortamında WebView'ı render et. 
          // (typeof document === 'undefined') koşulu, tarayıcıda olmadığımızı belirtir.
          if (typeof document !== 'undefined') {
              // Tarayıcı/Web ortamı: Çökmeyi önlemek için basit bir mesaj döndür
              return (
                  <div style={{ flex: 1, padding: 20, textAlign: 'center', backgroundColor: '#f0f0f0' }}>
                      <p style={{ marginTop: 50, fontWeight: 'bold' }}>Bu görünüm sadece mobil uygulama içinde aktiftir.</p>
                      <p>WebView bileşeni tarayıcıda kullanılamaz.</p>
                  </div>
              );
          }
          
          // 3. Native ortamı: WebView'u render et
          return (
             <WebView
                ref={webViewRef}
                source={{ uri: webUrl }}
                onMessage={onWebViewMessage} 
                javaScriptEnabled={true}
                injectedJavaScript={`window.activeTab = 'premium'; true;`}
                style={{ flex: 1, minHeight: 600 }}
             />
          ); 
      default:
        return <Dashboard userData={userData} meals={meals} updateUserData={updateUserData} deleteMeal={deleteMeal} />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Kalori & Diyet Takip - {userData?.username || 'Kullanıcı'}</title>
      </Helmet>
      <div className="mobile-container">
        <Header userData={userData} />
        <main className="pb-20 pt-16 flex-1 overflow-auto">
             {renderContent()}
         </main>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </>
  );
}