import React from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateCalorieTarget } from '@/lib/calculator'; // <-- YENİ KALORİ HESAPLAYICI IMPORTU

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Dashboard from '@/components/Dashboard';
import MealTracker from '@/components/MealTracker';
import Progress from '@/components/Progress';
import Profile from '@/components/Profile';
import Onboarding from '@/components/Onboarding';
import AuthScreen from '@/components/AuthScreen';
import { PremiumUyelik } from '@/components/PremiumUyelik'; 


function App() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [userData, setUserData] = React.useState(null); 
  const [meals, setMeals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // === SON VE KESİN SORGUNUZ (TEK SATIRDA) ===
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
        description: 'Profiliniz yüklenirken bir hata oluştu.', // Artık RLS değil, data hatasıdır
      });
    } else {
      setUserData(data);
    }
  }, [user, toast]);
  // ===========================================

  const fetchMeals = React.useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('added_meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Öğün yükleme hatası:', error);
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

  // === MANTIK FIX 1: PROFIL GUNCELLEME (KALORI HESAPLAMA) ===
  const updateUserData = React.useCallback(
    async (newData) => {
      if (!user) return;

      // 1. Yeni verileri mevcut verilerle birleştir (userData dependency'si eklendi)
      const combinedData = { ...userData, ...newData };

      // 2. Yeni hedef kaloriyi hesapla
      const newTargetCalories = calculateCalorieTarget(combinedData);
      
      // 3. Payload'u hazırla
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
    [user, toast, userData] // userData'yı dependency array'e ekledik
  );

  // === MANTIK FIX 2: ONBOARDING TAMAMLAMA (BAŞLANGIÇ KİLOSU VE KALORİ HESAPLAMA) ===
  const handleOnboardingComplete = async (formData) => {
    if (!user) return;
    
    // 1. Kalori Hedefi ve Başlangıç Kilosu Hesaplama/Ayarlama
    const target_calories = calculateCalorieTarget(formData);
    const start_weight = formData.weight; // Başlangıç kilosu, ilk kilonuzdur

    // 2. Verileri insert işlemine ekle
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
  
  // ... [Geri kalan kodlarınız aynı kalır] ...
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
        return <PremiumUyelik />; 
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
        <main className="pb-20 pt-16">{renderContent()}</main>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </>
  );
}

export default App;