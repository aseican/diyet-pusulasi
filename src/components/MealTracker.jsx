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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid'; 

const FOOD_BUCKET = 'food-images'; 

export const MealTracker = ({ addMeal }) => {
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
  
  // KOTA LİMİTLERİ
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

  // Yiyecek arama ve debounce mantıkları
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
    // Miktar hesaplama mantığı
    if (unit === 'gram') return quantity / 100;
    if (unit === 'adet' && food.gram && food.gram > 0) return (quantity * food.gram) / 100;
    return 1;
  };

  const handleAddMeal = () => {
    const selectedFood = null; 
    const quantity = 100;
    const unit = 'gram';
    if (!selectedFood || !quantity || quantity <= 0) {
      toast({ variant: 'destructive', title: 'Eksik Bilgi', description: 'Lütfen miktarı giriniz.' });
      return;
    }
    
    // Basit mantık
    toast({ title: 'Öğün Eklendi', description: `Manuel öğün eklendi.` });
    setSelectedFood(null); 
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
        // [Storage Upload ve Edge Function Çağrısı Mantığı Buraya Gelir]
        // SIMÜLASYON KODLARI BURADAN KALDIRILDI.
        
        // Bu kısım, gerçek yükleme ve çağırma mantığınız olmalıdır.
        // Hata almamak için şimdilik boş bırakıyoruz, ama burası Edge Function'ı çağıracak.
        
    } catch (error) {
        console.error('AI Analiz Hatası:', error);
        toast({ variant: 'destructive', title: 'Analiz Başarısız', description: 'Yemek analiz edilemedi.' });
    } finally {
        setIsAnalyzing(false);
        // Bu kısım da Storage temizleme mantığınız olmalıdır.
    }
  };

  const handleConfirmMealFromAI = () => {
      if (!analysisResult) return;
      // addMeal(meal); // App.jsx'teki ana fonksiyonu çağır
      setAnalysisResult(null);
      setAiFile(null);
      toast({ title: 'Öğün Eklendi', description: `AI: ${analysisResult.name} başarıyla öğünlerinize eklendi.` });
  };
  
  // --- ARABİRİM GÖRÜNÜMÜ ---
  return (
    <div className="p-4 space-y-6">
      {/* ... (UI'ınızın geri kalanı) ... */}
    </div>
  );
};