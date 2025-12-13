
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Loader2, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = "food-images";

// Plan limitleri
const planLimitsForUi = {
  free: { daily: 3, weekly: 15, monthly: 30 },
  basic: { daily: 10, weekly: 50, monthly: 100 },
  pro: { daily: 20, weekly: 100, monthly: 200 },
  kapsamli: { daily: 99999, weekly: 99999, monthly: 99999 },
  "sub_premium_monthly": { daily: 30, weekly: 150, monthly: 300 },
  "sub_pro_monthly": { daily: 50, weekly: 250, monthly: 500 },
  "sub_unlimited_monthly": { daily: 99999, weekly: 99999, monthly: 99999 }
};

export const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user, userData } = useAuth();

  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isQuotaReached, setIsQuotaReached] = useState(false);

  const fileInputRef = useRef(null);

  // Plan ve kota limitlerini al
  const currentPlan = userData?.plan_tier || 'free';
  const currentLimits = planLimitsForUi[currentPlan] || planLimitsForUi.free;
  const currentQuota = Number(userData?.ai_daily_used || 0);

  // Kota kontrolü ve limitleri düşürme
  const checkAndUpdateQuota = async () => {
    if (currentQuota >= currentLimits.daily) {
      setIsQuotaReached(true);
      toast({
        variant: 'destructive',
        title: 'Limit Doldu',
        description: 'Günlük AI kullanım limitiniz doldu.',
      });
      return false;
    }

    // Kota güncelleme işlemi
    const updatedQuota = currentQuota + 1;
    await supabase
      .from("profiles")
      .update({ ai_daily_used: updatedQuota })
      .eq("id", user.id);

    return true;
  };

  // Fotoğraf yükleme işlemi
  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      setAiFile(e.target.files[0]);
      setAnalysisResult(null);
    }
  };

  const removePhoto = () => {
    setAiFile(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Fotoğraf analizi işlemi
  const handleAnalyze = async () => {
    if (!aiFile || isAnalyzing) return;

    setIsAnalyzing(true);

    // Kota kontrolü
    const allowed = await checkAndUpdateQuota();
    if (!allowed) {
      setIsAnalyzing(false);
      return;
    }

    try {
      // Fotoğraf yükleme
      const ext = aiFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, aiFile);

      if (uploadError) throw uploadError;

      // Public URL
      const { data: publicData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(filePath);

      const imageUrl = publicData?.publicUrl;
      if (!imageUrl) throw new Error("PUBLIC_URL_FAIL");

      // AI analizi yap
      const { data, error } = await supabase.functions.invoke(
        "analyze-food-image",
        { body: { imageUrl }, headers: { Authorization: `Bearer ${user.access_token}` } }
      );

      if (error) throw error;
      setAnalysisResult(data);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Analiz Hatası",
        description: "Analiz yapılamadı.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fotoğrafın gösterimi (ikon şeklinde)
  const PhotoIcon = aiFile ? (
    <img src={URL.createObjectURL(aiFile)} alt="Fotoğraf" className="rounded-md w-16 h-16 object-cover" />
  ) : (
    <Camera className="w-16 h-16 text-emerald-600" />
  );

  //---------------------------------------------
  // MANUEL YEMEK EKLEME
  //---------------------------------------------
  const getMultiplier = (unit, quantity, food) => {
    let totalGram = 0;
    switch (unit) {
      case 'gram':
        totalGram = quantity;
        break;
      case 'adet':
        totalGram = quantity * (food.unit_gram || 100);
        break;
      case 'porsiyon':
        totalGram = quantity * (food.portion_gram || 200);
        break;
      case 'bardak':
        totalGram = quantity * 200;
        break;
      case 'kasik':
        totalGram = quantity * 15;
        break;
      default:
        totalGram = quantity;
    }

    // Ürün 100 gramlık değer içeriyor → multiplier hesaplıyoruz
    return totalGram / 100;
  };

  const handleAddMeal = () => {
    if (!selectedFood || !quantity || quantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Eksik Bilgi',
        description: 'Lütfen miktarı giriniz.',
      });
      return;
    }

    const multiplier = getMultiplier(unit, selectedFood);
    const meal = {
      meal_type: mealType,
      food_name: analysisResult?.name || "Bilinmeyen",
      calories: Number(analysisResult?.calories ?? 0),
      protein: Number(analysisResult?.protein ?? 0),
      carbs: Number(analysisResult?.carbs ?? 0),
      fat: Number(analysisResult?.fat ?? 0),
      quantity: Number(analysisResult?.quantity ?? 1),
      unit: analysisResult?.unit || "adet",
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
    };

    addMeal(meal);
    setSelectedFood(null);
    setSearchTerm('');
    setSearchResults([]);

    toast({
      title: 'Öğün Eklendi',
      description: `${meal.food_name} başarıyla eklendi.`,
    });
  };

  //---------------------------------------------
  // YEMEK ARAMA
  //---------------------------------------------
  const searchFoods = useCallback(async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('foods')
      .select('id, name_tr, calories, protein, carbs, fat, unit_gram, category')
      .ilike('name_tr', `%${searchTerm}%`)
      .limit(50);

    if (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Arama Hatası',
        description: 'Yiyecekler aranırken bir hata oluştu.',
      });
    } else {
      setSearchResults(data);
    }

    setLoading(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    const t = setTimeout(searchFoods, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchFoods]);

  //---------------------------------------------
  // YEMEK KATEGORİSİ İCON
  //---------------------------------------------
  const FoodIcon = ({ category }) => {
    const p = { className: 'w-6 h-6 text-emerald-600' };
    if (category === 'kahvalti') return <Coffee {...p} />;
    if (category === 'ana_yemek') return <Drumstick {...p} />;
    if (category === 'ara_ogun') return <Apple {...p} />;
    return <Utensils {...p} />;
  };

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
        <p className="text-gray-500">Geniş veritabanından yiyecek arayın veya fotoğrafla analiz edin.</p>
      </motion.div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Manuel Arama</TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-1" /> Yapay Zeka
          </TabsTrigger>
        </TabsList>

        {/* MANUEL ARAMA TAB */}
        <TabsContent value="manual" className="p-4 space-y-4 bg-white shadow rounded-b-lg">
          {/* Manuel arama içeriği */}
        </TabsContent>

        {/* AI TAB */}
        <TabsContent value="ai" className="p-4 space-y-4 bg-white shadow rounded-b-lg">
          {isQuotaReached && !analysisResult ? (
            <div className="text-center p-6 bg-red-50 border border-red-300 rounded-lg">
              <Zap className="mx-auto h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-red-600 mt-2">Günlük Limit Doldu</h3>
              <p className="text-sm text-red-700">Günlük hakkınız: {quotaLimit}</p>
              <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                Premium’a Yükselt
              </Button>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">
                Analiz Sonucu: {analysisResult.name}
              </h3>
              {/* Diğer içerik */}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <Label
                htmlFor="upload-ai"
                className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-emerald-300 border-dashed rounded-lg hover:bg-emerald-50"
              >
                <Camera className="h-8 w-8 text-emerald-500" />
                <p className="mt-2 font-medium text-emerald-700">Yemek Fotoğrafı Yükle</p>
              </Label>

              {/* Fotoğraf Yükleme ve Analiz Butonu */}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MealTracker;
