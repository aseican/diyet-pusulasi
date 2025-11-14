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

const FOOD_BUCKET = 'food-images'; 

export const MealTracker = ({ addMeal }) => { // Rollup Fix
  const { toast } = useToast();
  const { user, userData } = useAuth();
  
  // --- STATE'LER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null); 
  
  // KOTA LİMİTLERİ (En güncel kotalar)
  const quotaLimit = (() => {
    switch (userData?.plan_tier) {
      case 'basic': return 10; 
      case 'pro': return 30;   
      case 'kapsamli': return 50;
      default: return 3; 
    }
  })();
  const currentQuota = userData?.ai_usage_count || 0; 
  const isQuotaReached = currentQuota >= quotaLimit;

  // --- FONKSİYONLAR ---

  const searchFoods = useCallback(async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('foods')
      .select('id, name_tr, calories, protein, carbs, fat, gram, category')
      .ilike('name_tr', `%${searchTerm.trim()}%`)
      .limit(50);

    if (error) {
      console.error('Error searching foods:', error);
      toast({ variant: 'destructive', title: 'Arama Hatası', description: 'Yiyecekler aranırken bir hata oluştu.' });
    } else {
      setSearchResults(data);
    }
    setLoading(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchFoods();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, searchFoods]);

  const getMultiplier = (unit, food) => {
    const servingSize = food.gram || 100;
    switch(unit) {
      case 'gram': return quantity / 100;
      case 'adet': return (quantity * servingSize / 100);
      case 'porsiyon': return (quantity * servingSize / 100);
      case 'bardak': return (quantity * 200 / 100); 
      case 'kasik': return (quantity * 15 / 100); 
      default: return quantity / 100;
    }
  };

  const handleAddMeal = () => {
    if (!selectedFood || !quantity || quantity <= 0) {
      toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen miktarı giriniz.' });
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
        quantity: quantity,
        unit: unit,
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
    };
    
    addMeal(meal); 
    setSelectedFood(null); 
    setSearchTerm('');
    setSearchResults([]);
    toast({ title: 'Öğün Eklendi', description: `${meal.food_name} başarıyla öğünlerinize eklendi.` });
  };
  
  const FoodIcon = ({ category }) => {
    const defaultProps = { className: "w-6 h-6 text-emerald-600" };
    switch (category) {
      case 'kahvalti': return <Coffee {...defaultProps} />;
      case 'ana_yemek': return <Drumstick {...defaultProps} />;
      case 'ara_ogun': return <Apple {...defaultProps} />;
      default: return <Utensils {...defaultProps} />;
    }
  };

  const calculatedMacros = selectedFood ? (() => {
    const multiplier = getMultiplier(unit, selectedFood);
    const totalMultiplier = quantity * multiplier;
    return {
        calories: (selectedFood.calories * totalMultiplier).toFixed(0),
        protein: (selectedFood.protein * totalMultiplier).toFixed(1),
        carbs: (selectedFood.carbs * totalMultiplier).toFixed(1),
        fat: (selectedFood.fat * totalMultiplier).toFixed(1),
    }
  })() : null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setAiFile(e.target.files[0]);
        setAnalysisResult(null); 
    }
  };

  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // KOTA KONTROLÜ
    if (isQuotaReached) { 
        toast({ variant: 'destructive', title: 'Limit Doldu', description: `Günlük ${quotaLimit} hakkınızı kullandınız. Lütfen planınızı yükseltin.` });
        setIsAnalyzing(false);
        return;
    }
    
    let publicUrl = null;
    let filePath = null;
    
    try {
        // 1. ADIM: Resmi Supabase Storage'a Yükle
        const fileExt = aiFile.name.split('.').pop();
        const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
        filePath = `food-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(FOOD_BUCKET)
          .upload(filePath, aiFile);

        if (uploadError) throw uploadError;

        // 2. ADIM: Yüklenen resmin URL'sini al
        const { data: urlData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;
        
        // 3. ADIM: Supabase Edge Function'ı (AI) çağır
        const { data: analysisResult, error: functionError } = await supabase.functions.invoke(
            'analyze-food-image', 
            { body: { imageUrl: publicUrl } } 
        );

        if (functionError) throw functionError;
        
        // 4. ADIM: Sonucu göster (Izgara Somon simülasyonu SİLİNDİ)
        setAnalysisResult(analysisResult); 
        
    } catch (error) {
        console.error('AI Analiz Hatası:', error);
        toast({ variant: 'destructive', title: 'Analiz Başarısız', description: error.message || 'Yemek analiz edilemedi.' });
    } finally {
        setIsAnalyzing(false);
        // Dosyayı temizlemek için Storage'dan siliyoruz
        if (filePath) {
          await supabase.storage.from(FOOD_BUCKET).remove([filePath]); 
        }
    }
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
      date: new Date().toISOString().split('T')[0],
    };
    
    addMeal(meal); 
    setAnalysisResult(null);
    setAiFile(null);
    toast({ title: 'Öğün Eklendi', description: `${meal.food_name} (AI) başarıyla öğünlerinize eklendi.` });
  };
  
  // --- ARABİRİM GÖRÜNÜMÜ ---
  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
        <p className="text-gray-500">Geniş veritabanımızdan arayarak öğünlerinizi ekleyin.</p>
      </motion.div>
      
      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manuel Arama</TabsTrigger>
            <TabsTrigger value="ai" className="text-emerald-600 font-bold">
                <Zap className="h-4 w-4 mr-1" /> Yapay Zeka
            </TabsTrigger>
        </TabsList>

        {/* 1. MANUEL GİRİŞ TABI */}
        <TabsContent value="manual" className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                type="text"
                placeholder="Yiyecek ara..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="space-y-2 bg-white rounded-xl p-2 max-h-[250px] overflow-y-auto">
                <AnimatePresence>
                {loading ? (
                    <div className="flex justify-center items-center p-4"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
                ) : (
                    searchResults.map((food) => (
                        <motion.div
                            key={food.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                                setSelectedFood(food);
                                setQuantity(food.gram > 1 ? 1 : 100);
                                setUnit(food.gram > 1 ? 'adet' : 'gram');
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <FoodIcon category={food.category} />
                                <div>
                                    <p className="font-semibold text-gray-800">{food.name_tr}</p>
                                    <p className="text-sm text-gray-500">{food.calories} kcal / {food.gram || 100}g</p>
                                </div>
                            </div>
                            <Plus className="w-5 h-5 text-emerald-500" />
                        </motion.div>
                    ))
                )}
                </AnimatePresence>
                {!loading && searchResults.length === 0 && searchTerm.length > 1 && (
                    <div className="text-center p-4 text-gray-500">Sonuç bulunamadı.</div>
                )}
            </div>
        </TabsContent>

        {/* 2. YAPAY ZEKÂ TABI - Sınırlama ve Arayüz Eklendi */}
        <TabsContent value="ai" className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg">
            
            {/* KOTA AŞIMI veya SONUÇ EKRANI */}
            {isQuotaReached && !analysisResult ? (
                // KOTA AŞIM EKRANI
                <div className="text-center p-8 border-2 border-red-300 border-dashed rounded-lg bg-red-50 space-y-3">
                    <Zap className="h-8 w-8 mx-auto text-red-500" />
                    <h3 className="font-bold text-lg text-red-700">Günlük Limit Aşıldı</h3>
                    <p className="text-sm text-red-600">
                        Günlük **{quotaLimit}** adet AI analiz hakkınızı kullandınız. Lütfen planınızı yükseltin.
                    </p>
                    <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">Premium'a Yükselt</Button>
                </div>
            ) : analysisResult ? (
                // ANALİZ SONUÇ EKRANI
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800">Analiz Sonucu: {analysisResult.name}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-gray-100 rounded-lg">Kcal: <span className="font-bold text-emerald-600">{analysisResult.calories}</span></div>
                        <div className="p-3 bg-gray-100 rounded-lg">Protein: <span className="font-bold">{analysisResult.protein.toFixed(1)}g</span></div>
                        <div className="p-3 bg-gray-100 rounded-lg">Karbonhidrat: <span className="font-bold">{analysisResult.carbs.toFixed(1)}g</span></div>
                        <div className="p-3 bg-gray-100 rounded-lg">Yağ: <span className="font-bold">{analysisResult.fat.toFixed(1)}g</span></div>
                        <div className="col-span-2 p-3 bg-gray-100 rounded-lg">Miktar: <span className="font-bold">{analysisResult.quantity} {analysisResult.unit}</span></div>
                    </div>
                    <Button onClick={handleConfirmMealFromAI} className="w-full bg-emerald-600 hover:bg-emerald-700">
                        Öğün Olarak Kaydet
                    </Button>
                    <Button onClick={() => setAnalysisResult(null)} variant="outline" className="w-full">
                        İptal ve Yeni Analiz
                    </Button>
                </div>
            ) : (
                // YÜKLEME VE ANALİZ BUTONLARI
                <div className="space-y-3 pt-2">
                    <input type="file" onChange={handleFileChange} accept="image/*" id="ai-file-upload" className="hidden" />
                    <Label htmlFor="ai-file-upload" className="flex flex-col items-center justify-center p-8 border-2 border-emerald-300 border-dashed rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors">
                        <Camera className="h-8 w-8 text-emerald-500" />
                        <p className="mt-2 font-semibold text-emerald-700">Yemek Fotoğrafı Yükle</p>
                        <p className="text-sm text-gray-500">Maksimum 5MB, JPEG/PNG</p>
                        {aiFile && <p className="mt-2 text-sm text-gray-800 font-medium">Seçilen Dosya: {aiFile.name}</p>}
                    </Label>

                    <Button onClick={handleAnalyze} disabled={!aiFile || isAnalyzing} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analiz Ediliyor...
                            </>
                        ) : (
                            <>
                                <Zap className="mr-2 h-4 w-4" />
                                Yemeği Analiz Et
                            </>
                        )}
                    </Button>
                </div>
            )}
            
            {/* Kota Gösterimi */}
            <p className="text-xs text-muted-foreground pt-2 text-center">
                Kalan hakkınız: {isQuotaReached ? '0' : (quotaLimit - currentQuota)}. Günlük toplam hakkınız: {quotaLimit}.
            </p>
        </TabsContent>
    </Tabs>

    {/* Manuel Giriş Modal'ı */}
    <Dialog open={!!selectedFood} onOpenChange={() => setSelectedFood(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Öğün Ekle: {selectedFood?.name_tr}</DialogTitle>
          <DialogDescription>
            Miktarı ve öğün türünü seçerek ekleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="quantity">Miktar</Label>
              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))} className="text-lg font-bold mt-1"/>
            </div>
            <div className="w-1/3">
              <Label htmlFor="unit">Birim</Label>
              <Select onValueChange={setUnit} value={unit}>
                <SelectTrigger id="unit" className="mt-1"><SelectValue /></SelectTrigger>
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
          
          <Select onValueChange={setMealType} defaultValue={mealType}>
            <SelectTrigger><SelectValue placeholder="Öğün Türü Seçin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Kahvaltı">Kahvaltı</SelectItem>
              <SelectItem value="Öğle Yemeği">Öğle Yemeği</SelectItem>
              <SelectItem value="Akşam Yemeği">Akşam Yemeği</SelectItem>
              <SelectItem value="Atıştırmalık">Atıştırmalık</SelectItem>
            </SelectContent>
          </Select>
        
          {calculatedMacros && (
            <div className="mt-3 p-3 border rounded-lg bg-emerald-50 text-sm">
                <p className="font-semibold text-gray-800">Hesaplanan Değerler ({quantity} {unit}):</p>
                <p>Kalori: <span className="font-bold">{Math.round(selectedFood.calories * getMultiplier(unit, selectedFood))} kcal</span></p>
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