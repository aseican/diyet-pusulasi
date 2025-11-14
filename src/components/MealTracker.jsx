// ======================================================================
//                        FULL & WORKING MealTracker.jsx
// ======================================================================

import React, { useState, useCallback, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = "food-images";

export const MealTracker = ({ addMeal }) => {

  const { toast } = useToast();
  const { user, userData } = useAuth();

  // STATE'LER
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("gram");
  const [mealType, setMealType] = useState("Kahvaltı");

  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // ======== KOTA LIMITI ==========
  const quotaLimit =
    userData?.plan_tier === "basic"
      ? 10
      : userData?.plan_tier === "pro"
      ? 30
      : userData?.plan_tier === "kapsamli"
      ? 50
      : 3;

  const currentQuota = userData?.ai_usage_count || 0;
  const isQuotaReached = currentQuota >= quotaLimit;

  // =====================================================
  //                       SEARCH
  // =====================================================
  const searchFoods = useCallback(async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("foods")
      .select("id, name_tr, calories, protein, carbs, fat, gram, category")
      .ilike("name_tr", `%${searchTerm}%`)
      .limit(50);

    if (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Arama Hatası", description: "Bir sorun oluştu." });
    } else {
      setSearchResults(data);
    }

    setLoading(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    const t = setTimeout(searchFoods, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchFoods]);

  // =====================================================
  //                MANUEL YEMEK EKLEME
  // =====================================================
  const getMultiplier = (unit, food) => {
    const servingSize = food.gram || 100;

    switch (unit) {
      case "gram": return quantity / 100;
      case "adet": return (quantity * servingSize) / 100;
      case "porsiyon": return (quantity * servingSize) / 100;
      case "bardak": return (quantity * 200) / 100;
      case "kasik": return (quantity * 15) / 100;
      default: return quantity / 100;
    }
  };

  const handleAddMeal = () => {
    if (!selectedFood || !quantity || quantity <= 0) {
      toast({ variant: "destructive", title: "Eksik Bilgi", description: "Miktar girin." });
      return;
    }

    const multiplier = getMultiplier(unit, selectedFood);

    const meal = {
      meal_type: mealType,
      food_name: selectedFood.name_tr,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: parseFloat((selectedFood.protein * multiplier).toFixed(1)),
      carbs: parseFloat((selectedFood.carbs * multiplier).toFixed(1)),
      fat: parseFloat((selectedFood.fat * multiplier).toFixed(1)),
      quantity,
      unit,
      user_id: user.id,
      date: new Date().toISOString().split("T")[0],
    };

    addMeal(meal);
    setSelectedFood(null);
    setSearchTerm("");
    setSearchResults([]);

    toast({ title: "Öğün Eklendi", description: `${meal.food_name} başarıyla eklendi.` });
  };

  // =====================================================
  //                     AI ANALYZE
  // =====================================================
  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      setAiFile(e.target.files[0]);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    if (isQuotaReached) {
      toast({
        variant: "destructive",
        title: "Limit Doldu",
        description: `Günlük ${quotaLimit} analiz hakkınızı kullandınız.`,
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      // 1) Upload
      const ext = aiFile.name.split(".").pop();
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, aiFile);

      if (uploadError) {
        toast({ variant: "destructive", title: "Yükleme Hatası", description: "Fotoğraf yüklenemedi." });
        setIsAnalyzing(false);
        return;
      }

      // 2) Public URL
      const { data: publicData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(filePath);
      const imageUrl = publicData.publicUrl;

      // 3) Token Al
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast({ variant: "destructive", title: "Yetki Hatası", description: "Oturum bulunamadı." });
        setIsAnalyzing(false);
        return;
      }

      // 4) Edge Function Çağır
      const { data, error } = await supabase.functions.invoke(
        "analyze-food-image",
        {
          body: { imageUrl },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        console.error("EDGE ERROR:", error);
        toast({ variant: "destructive", title: "AI Hatası", description: "Analiz sırasında bir sorun oluştu." });
        setIsAnalyzing(false);
        return;
      }

      setAnalysisResult(data);

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Analiz Hatası", description: "İşlem başarısız." });
    }

    setIsAnalyzing(false);
  };

  const handleConfirmMealFromAI = () => {
    if (!analysisResult) return;

    const meal = {
      meal_type: mealType,
      food_name: analysisResult.name,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbs: analysisResult.carbs,
      fat: analysisResult.fat,
      quantity: analysisResult.quantity,
      unit: analysisResult.unit,
      user_id: user.id,
      date: new Date().toISOString().split("T")[0],
    };

    addMeal(meal);
    setAnalysisResult(null);
    setAiFile(null);

    toast({ title: "Öğün Eklendi", description: `${meal.food_name} başarıyla kaydedildi.` });
  };

  // =====================================================
  //                        UI
  // =====================================================

  const FoodIcon = ({ category }) => {
    const p = { className: "w-6 h-6 text-emerald-600" };
    if (category === "kahvalti") return <Coffee {...p} />;
    if (category === "ana_yemek") return <Drumstick {...p} />;
    if (category === "ara_ogun") return <Apple {...p} />;
    return <Utensils {...p} />;
  };

  const calculatedMacros = selectedFood
    ? (() => {
        const multiplier = getMultiplier(unit, selectedFood);
        const total = quantity * multiplier;
        return {
          calories: (selectedFood.calories * total).toFixed(0),
          protein: (selectedFood.protein * total).toFixed(1),
          carbs: (selectedFood.carbs * total).toFixed(1),
          fat: (selectedFood.fat * total).toFixed(1),
        };
      })()
    : null;

  return (
    <div className="p-4 space-y-6">

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
        <p className="text-gray-500">Geniş veritabanından yiyecek arayın veya fotoğrafla analiz edin.</p>
      </motion.div>

      {/* -------------------------------------------------- */}
      {/*                   TABS (MANUAL / AI)              */}
      {/* -------------------------------------------------- */}

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Manuel Arama</TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-1" /> Yapay Zeka
          </TabsTrigger>
        </TabsList>

        {/* ================== MANUEL ARAMA TAB ==================== */}
        <TabsContent value="manual" className="p-4 space-y-4 bg-white shadow rounded-b-lg">

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Yiyecek ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center p-4">
                <Loader2 className="animate-spin text-emerald-600 w-6 h-6" />
              </div>
            ) : (
              searchResults.map((food) => (
                <motion.div
                  key={food.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setSelectedFood(food);
                    setQuantity(food.gram > 1 ? 1 : 100);
                    setUnit(food.gram > 1 ? "adet" : "gram");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <FoodIcon category={food.category} />
                    <div>
                      <p className="font-semibold">{food.name_tr}</p>
                      <p className="text-sm text-gray-500">{food.calories} kcal</p>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-emerald-600" />
                </motion.div>
              ))
            )}
          </div>

        </TabsContent>

        {/* ===================== AI TAB ====================== */}
        <TabsContent value="ai" className="p-4 space-y-4 bg-white shadow rounded-b-lg">

          {/* Kota aşımı */}
          {isQuotaReached && !analysisResult && (
            <div className="text-center p-6 bg-red-50 border border-red-300 rounded-lg">
              <Zap className="mx-auto h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-red-600 mt-2">Günlük Limit Doldu</h3>
              <p className="text-sm text-red-700">Günlük hakkınız: {quotaLimit}</p>
              <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                Premium’a Yükselt
              </Button>
            </div>
          )}

          {/* ANALİZ SONUCU */}
          {analysisResult ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">
                Analiz Sonucu: {analysisResult.name}
              </h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-100 rounded-lg">
                  Kcal: <span className="font-bold text-emerald-600">{analysisResult.calories}</span>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  Protein: {analysisResult.protein}g
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  Karbonhidrat: {analysisResult.carbs}g
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  Yağ: {analysisResult.fat}g
                </div>
                <div className="col-span-2 p-3 bg-gray-100 rounded-lg">
                  Miktar: {analysisResult.quantity} {analysisResult.unit}
                </div>
              </div>

              <Button onClick={handleConfirmMealFromAI} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Öğün Olarak Kaydet
              </Button>

              <Button variant="outline" onClick={() => setAnalysisResult(null)} className="w-full">
                Yeni Analiz
              </Button>
            </div>
          ) : !isQuotaReached && (
            <div className="space-y-3">

              {/* Fotoğraf yükleme */}
              <input type="file" accept="image/*" id="upload-ai" className="hidden"
                onChange={handleFileChange}
              />

              <Label htmlFor="upload-ai" className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-emerald-300 border-dashed rounded-lg hover:bg-emerald-50">
                <Camera className="h-8 w-8 text-emerald-500" />
                <p className="mt-2 font-medium text-emerald-700">Yemek Fotoğrafı Yükle</p>
                {aiFile && <p className="text-sm text-gray-800 mt-2">{aiFile.name}</p>}
              </Label>

              <Button
                onClick={handleAnalyze}
                disabled={!aiFile || isAnalyzing}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" /> Yemeği Analiz Et
                  </>
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-gray-500">
            Kalan hakkınız: {quotaLimit - currentQuota}
          </p>

        </TabsContent>
      </Tabs>

      {/* ===================== MODAL ====================== */}
      <Dialog open={!!selectedFood} onOpenChange={(v) => !v && setSelectedFood(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedFood?.name_tr}</DialogTitle>
            <DialogDescription>Miktar ve öğün türünü seç.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-end gap-2">

              <div className="flex-1">
                <Label>Miktar</Label>
                <Input
                  type="number"
                  value={quantity}
                  className="mt-1"
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value)))}
                />
              </div>

              <div className="w-32">
                <Label>Birim</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gram">Gram</SelectItem>
                    <SelectItem value="adet">Adet</SelectItem>
                    <SelectItem value="porsiyon">Porsiyon</SelectItem>
                    <SelectItem value="bardak">Bardak</SelectItem>
                    <SelectItem value="kasik">Kaşık</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Kahvaltı">Kahvaltı</SelectItem>
                <SelectItem value="Öğle Yemeği">Öğle Yemeği</SelectItem>
                <SelectItem value="Akşam Yemeği">Akşam Yemeği</SelectItem>
                <SelectItem value="Atıştırmalık">Atıştırmalık</SelectItem>
              </SelectContent>
            </Select>

            {calculatedMacros && (
              <div className="p-3 bg-emerald-50 border rounded-lg text-sm">
                <p className="font-semibold text-gray-800">Hesaplanan Değerler:</p>
                <p>Kalori: <b>{calculatedMacros.calories} kcal</b></p>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button onClick={handleAddMeal} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Öğün Olarak Ekle
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
};

// ======================================================================
//                            END OF FILE
// ======================================================================
