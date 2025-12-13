import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Utensils, Drumstick, Apple, Coffee, Loader2, Zap, Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = "food-images";

export const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user, userData } = useAuth();

  // AI kota UI hesapları (sadece görsel gösterim için)
  const planLimitsForUi = {
    free: { daily: 3 }, 
    basic: { daily: 10 },
    pro: { daily: 20 },
    kapsamli: { daily: 99999 },
    "sub_premium_monthly": { daily: 30 },
    "sub_pro_monthly": { daily: 50 },
    "sub_unlimited_monthly": { daily: 99999 }
  };

  const currentPlan = userData?.plan_tier || 'free';
  const quotaLimit = planLimitsForUi[currentPlan]?.daily ?? planLimitsForUi.free.daily;
  const currentQuota = Number(userData?.ai_daily_used ?? 0);
  const isQuotaReached = currentQuota >= quotaLimit;

  // STATE'LER
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');

  // AI FOTOĞRAF STATE
  const fileInputRef = useRef(null);
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  //---------------------------------------------
  // KOTA KONTROLÜ
  //---------------------------------------------
  const PLAN_LIMITS = {
    free: { daily: 3, monthly: 3 },
    basic: { daily: 10, monthly: 30 },
    pro: { daily: 20, monthly: 60 },
    kapsamli: { daily: 99999, monthly: 99999 },
    "sub_premium_monthly": { daily: 30, monthly: 1000 },
    "sub_pro_monthly": { daily: 50, monthly: 2000 },
    "sub_unlimited_monthly": { daily: 99999, monthly: 99999 }
  };

  const getQuotaData = (user) => {
    const plan = user.plan_tier || "free";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const dailyUsed = user.ai_usage_daily || 0;
    const monthlyUsed = user.ai_usage_monthly || 0;

    return {
      limits,
      dailyUsed,
      monthlyUsed,
      dailyRemaining: limits.daily - dailyUsed,
      monthlyRemaining: limits.monthly - monthlyUsed,
      isDailyExceeded: dailyUsed >= limits.daily,
      isMonthlyExceeded: monthlyUsed >= limits.monthly,
    };
  };

  //---------------------------------------------
  // FOTOĞRAF SEÇİLDİĞİNDE
  //---------------------------------------------
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

  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Fotoğraf Yükleme
      const ext = aiFile.name.split(".").pop();
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

      // AI Analiz
      const { data, error } = await supabase.functions.invoke(
        "analyze-food-image",
        { body: { imageUrl }, headers: { Authorization: `Bearer ${user.access_token}` } }
      );

      if (error) throw error;

      setAnalysisResult(data);
      await incrementAiUsage(supabase, user.id);

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Analiz Hatası", description: "Analiz yapılamadı." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Yüklenen fotoğrafın ikonunu gösterme
  const PhotoIcon = aiFile ? (
    <img src={URL.createObjectURL(aiFile)} alt="Fotoğraf Yükleniyor" className="rounded-md w-16 h-16 object-cover" />
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

export { MealTracker };
export default MealTracker;
