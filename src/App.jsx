import React, { useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateCalorieTarget } from '@/lib/calculator';

// Native WebView import etmiyoruz, dynamic require ile çözeceğiz
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

// 🟢 WebView'ı sadece Native Ortamda (APK) yüklemek için geçici bir değişken tanımlayalım.
let WebViewComponent;
try {
  // Eğer Native ortamda çalışıyorsa, require başarılı olur.
  WebViewComponent = require('react-native-webview').WebView;
} catch (e) {
  // Eğer Web ortamında çalışıyorsa, require başarısız olur ve biz WebView'ı bir mock ile değiştiririz.
  WebViewComponent = (props) => (
    <div
      {...props}
      style={{
        ...props.style,
        backgroundColor: '#f0f0f0',
        border: '2px solid #ccc',
        textAlign: 'center',
        paddingTop: 50,
      }}
    >
      <p style={{ fontWeight: 'bold' }}>
        Bu içerik sadece Native (APK) ortamında görüntülenebilir.
      </p>
    </div>
  );
}

export function App() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [userData, setUserData] = React.useState(null);
  const [meals, setMeals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // WebView komponentine erişmek için
  const webViewRef = useRef(null);

  // Web sitesinin ana URL'si
  const BASE_WEB_URL = 'https://diyettakip.org';

  // Supabase oturum token'ını alır.
  const getSupabaseSessionToken = React.useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, [user]);

  // === FETCH USER DATA (Tek Satır Sorgu) ===
  const fetchUserData = React.useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id,username,target_calories,created_at,gender,age,height,weight,target_weight,goal_type,activity_level,start_weight,water_intake,daily_water_goal,last_reset_date,plan_tier,ai_usage_count,premium_expires_at'
      )
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

  // === FETCH MEALS ===
  const fetchMeals = React.useCallback(async () => {
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

  // === PROFİL GÜNCELLEME (kalori hesap + su vs.) ===
  const updateUserData = React.useCallback(
    async (newData) => {
      if (!user) return;

      const combinedData = { ...userData, ...newData };
      const newTargetCalories = calculateCalorieTarget(combinedData);

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

  // === ONBOARDING TAMAMLAMA ===
  const handleOnboardingComplete = async (formData) => {
    if (!user) return;

    const target_calories = calculateCalorieTarget(formData);
    const start_weight = formData.weight;

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
        description:
          'Bilgiler kaydedilirken bir hata oluştu. RLS politikasını kontrol edin.',
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

  // 🧠 WebView'dan gelen mesajları işler (SATIN ALMA)
  const onWebViewMessage = React.useCallback(
    async (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'START_PURCHASE') {
          console.log('WebView\'dan ödeme isteği alındı:', data.productId);
          const token = await getSupabaseSessionToken();
          await handlePurchase(
            data.productId,
            webViewRef,
            updateUserData,
            toast,
            token
          );
        }
      } catch (e) {
        console.error('WebView message parse error:', e);
      }
    },
    [updateUserData, toast, getSupabaseSessionToken]
  );

  // === INITIAL DATA FETCH ===
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
  // Web'de normal premium sayfası göster
  if (typeof window !== 'undefined') {
    return <PremiumUyelik onPurchaseClick={() => {
      window.alert("Premium satın alma işlemi sadece mobil uygulamada yapılabilir!");
      window.location.href = "https://siten.com/app-download"; // ← APK indirme linki
    }} />;
  }

  // Native ortam: WebView üzerinden ödeme
  return (
    <WebViewComponent
      ref={webViewRef}
      source={{ uri: BASE_WEB_URL }}
      onMessage={onWebViewMessage}
      javaScriptEnabled={true}
      injectedJavaScript={`window.activeTab = 'premium'; true;`}
      style={{ flex: 1, minHeight: 600 }}
    />
  );

      default:
        return (
          <Dashboard
            userData={userData}
            meals={meals}
            updateUserData={updateUserData}
            deleteMeal={deleteMeal}
          />
        );
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
