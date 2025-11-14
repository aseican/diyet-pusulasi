import { useAuth } from '@/contexts/SupabaseAuthContext';
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Utensils, Drumstick, Apple, Coffee, Loader2, Zap, Camera, Upload } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Tabs bileşenini doğru yerden çekiyoruz
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid kurmanız gerekir

const FOOD_BUCKET = 'food-images'; // Supabase Storage kovasının adı (daha önce planlanmıştı)

const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user, userData } = useAuth(); // Auth verisini çekiyoruz
  
  // --- MANUEL GİRİŞ STATE'LERİ (Sizin Kodunuz) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');

  // --- AI GİRİŞ STATE'LERİ (Yeni) ---
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null); // AI'dan gelen sonuç


  // ... [Sizin searchFoods, useEffect, getMultiplier, handleAddMeal, FoodIcon fonksiyonlarınız aynı kalır] ...

  // Yeterince uzun olduğu için searchFoods ve useEffect'i dışarıda tutalım:
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
     // ... (Miktar hesaplama mantığınız) ...
  };
  
  const handleAddMeal = () => {
    // ... (Yemek ekleme mantığınız) ...
  };
  
  const FoodIcon = ({ category }) => {
    // ... (İkon gösterme mantığınız) ...
  };

  const calculatedMacros = selectedFood ? (() => {
    // ... (Makro hesaplama mantığınız) ...
  })() : null;


  // --- AI ANALİZ VE YÜKLEME MANTIĞI ---

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setAiFile(e.target.files[0]);
        setAnalysisResult(null); // Yeni resim seçilince sonucu sıfırla
    }
  };

  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    // KOTA KONTROLÜ
    const currentQuota = userData?.ai_usage_count || 0; 
    const quotaLimit = userData?.plan_tier === 'basic' ? 3 : userData?.plan_tier === 'pro' ? 7 : Infinity;
    
    if (userData?.plan_tier !== 'kapsamli' && currentQuota >= quotaLimit) {
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
        
        // 4. ADIM: Sonucu göster 
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
      
      const mealData = {
          name: analysisResult.name,
          calories: Number(analysisResult.calories),
          // AI ile gelen diğer verileri buraya ekleyebilirsin
      };
      
      addMeal(mealData); // App.jsx'teki ana fonksiyonu çağır
      setAnalysisResult(null);
      setAiFile(null);
      toast({ title: 'Eklendi', description: `AI: ${analysisResult.name} başarıyla eklendi.` });
  };


  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
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
            <p className="text-gray-500">Geniş veritabanımızdan arayarak öğünlerinizi ekleyin.</p>
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
            
            <div className="space-y-2 bg-white rounded-xl p-2 max-h-[250px] overflow-y-auto border">
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

        {/* 2. YAPAY ZEKA TABI */}
        <TabsContent value="ai" className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg">
            <p className="text-sm text-gray-600">
                Yapay zeka ile yemeğinizin fotoğrafını yükleyerek kalori tahmini alın. (Kotalı Premium özellik)
            </p>
            
            {analysisResult && (
                <div className="p-3 border border-emerald-400 bg-emerald-50 rounded-lg space-y-2">
                    <h3 className="font-bold">Analiz Sonucu:</h3>
                    <p className="text-xl font-medium">{analysisResult.name}</p>
                    <p className="text-2xl font-bold text-emerald-700">{analysisResult.calories} kcal</p>
                    <Button onClick={handleConfirmMealFromAI} className="w-full">
                        Öğünlerime Ekle ve Onayla
                    </Button>
                </div>
            )}

            {!analysisResult && (
                <div className="space-y-3 pt-2">
                    <Label htmlFor="file-upload" className="text-base font-semibold block">1. Fotoğraf Yükle</Label>
                    <Input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} className="p-2 border-dashed" />
                    
                    <Button 
                        onClick={handleAnalyze} 
                        disabled={!aiFile || isAnalyzing}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        {isAnalyzing ? 'Analiz Ediliyor...' : '2. Yapay Zeka ile Analiz Et'}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground pt-2 text-center">
                        Kalan hakkınız: {userData?.plan_tier === 'kapsamli' ? 'Sınırsız' : `${userData?.ai_usage_count || 0} / ${quotaLimit}`}.
                    </p>
                </div>
            )}
        </TabsContent>
    </Tabs>

    {/* Manuel Giriş Modal'ı */}
    <Dialog open={!!selectedFood} onOpenChange={() => setSelectedFood(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedFood?.name_tr}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4 text-center bg-gray-50 p-4 rounded-lg">
              <div><p className="font-bold text-xl text-emerald-600">{calculatedMacros.calories}</p><p className="text-sm text-gray-500">Kalori</p></div>
              <div><p className="font-bold text-xl text-blue-600">{calculatedMacros.protein}g</p><p className="text-sm text-gray-500">Protein</p></div>
              <div><p className="font-bold text-xl text-orange-600">{calculatedMacros.carbs}g</p><p className="text-sm text-gray-500">Karbonhidrat</p></div>
              <div><p className="font-bold text-xl text-red-600">{calculatedMacros.fat}g</p><p className="text-sm text-gray-500">Yağ</p></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedFood(null)}>İptal</Button>
          <Button onClick={handleAddMeal}>Öğüne Ekle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default MealTracker;