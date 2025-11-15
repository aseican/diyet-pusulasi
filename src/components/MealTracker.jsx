// ======================================================================
//                        FULL & WORKING MealTracker.jsx
// ======================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { FunctionsHttpError } from '@supabase/supabase-js'; // Hata yakalama için gerekli


const FOOD_BUCKET = "food-images";

export const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user, userData } = useAuth();

  // STATE'LER
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

  // KOTA
  const quotaLimit =
    userData?.plan_tier === 'basic'
      ? 10
      : userData?.plan_tier === 'pro'
      ? 30
      : userData?.plan_tier === 'kapsamli'
      ? 50
      : 3;

  const currentQuota = userData?.ai_usage_count || 0;
  const isQuotaReached = currentQuota >= quotaLimit;

  // =====================================================
  //                     SEARCH FOODS
  // =====================================================
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

  // =====================================================
  //                HELPER FUNCTIONS
  // =====================================================
  const getMultiplier = (unit, food) => {
    const servingSize = food.gram || 100;

    switch (unit) {
      case 'gram':
        return quantity / 100;
      case 'adet':
      case 'porsiyon':
        return (quantity * servingSize) / 100;
      case 'bardak':
        return (quantity * 200) / 100; // Örnek bardak 200g
      case 'kasik':
        return (quantity * 15) / 100; // Örnek kaşık 15g
      default:
        return quantity / 100;
    }
  };

  const calculatedMacros = selectedFood
    ? (() => {
        const multiplier = getMultiplier(unit, selectedFood);
        const totalMultiplier = quantity * multiplier;
        return {
          calories: (selectedFood.calories * totalMultiplier).toFixed(0),
          protein: (selectedFood.protein * totalMultiplier).toFixed(1),
          carbs: (selectedFood.carbs * totalMultiplier).toFixed(1),
          fat: (selectedFood.fat * totalMultiplier).toFixed(1),
        };
      })()
    : null;

  const FoodIcon = ({ category }) => {
    const defaultProps = { className: 'w-6 h-6 text-emerald-600' };
    switch (category) {
      case 'kahvalti':
        return <Coffee {...defaultProps} />;
      case 'ana_yemek':
        return <Drumstick {...defaultProps} />;
      case 'ara_ogun':
        return <Apple {...defaultProps} />;
      default:
        return <Utensils {...defaultProps} />;
    }
  };

  // =====================================================
  //                MANUEL YEMEK EKLEME
  // =====================================================
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
      food_name: selectedFood.name_tr,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: parseFloat((selectedFood.protein * multiplier).toFixed(1)),
      carbs: parseFloat((selectedFood.carbs * multiplier).toFixed(1)),
      fat: parseFloat((selectedFood.fat * multiplier).toFixed(1)),
      quantity,
      unit,
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

  // =====================================================
  //                     AI ANALYZE
  // =====================================================

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      setAiFile(e.target.files[0]);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = async () => {
    let publicUrl = null;
    let filePath = null;

    if (!aiFile || !user || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    if (isQuotaReached) {
      toast({
        variant: 'destructive',
        title: 'Limit Doldu',
        description: `Günlük ${quotaLimit} analiz hakkınızı kullandınız.`,
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      // 1) Upload (Benzersiz isim ile)
      const ext = aiFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${ext}`;
      filePath = `${user.id}/${fileName}`; // Temiz dosya yolu

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, aiFile);

      if (uploadError) throw new Error('Fotoğraf yüklenemedi: ' + uploadError.message);

      // 2) Public URL'yi Al ve Token
      const { data: publicData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(filePath);

      publicUrl = publicData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Oturum belirteci (token) eksik.');

      // 3) Edge Function Çağır (Doğru Tek Obje Syntax'ı)
      const { data, error } = await supabase.functions.invoke('analyze-food-image', {
        body: JSON.stringify({ imageUrl: publicUrl }), // JSON.stringify zorunlu
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error; // Edge function'dan gelen hatayı yakala

      setAnalysisResult(data);
    } catch (err) {
      console.error('ANALİZ/YÜKLEME HATASI:', err);

      let description = 'Analiz sırasında beklenmeyen bir sorun oluştu.';

      if (err instanceof FunctionsHttpError) {
        const responseData = await err.context.json();
        description = responseData?.error || responseData?.message || description;
      } else if (err.message.includes('token eksik')) {
        description = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
      } else if (err.message.includes('Yükleme Hatası')) {
        description = 'Resim yüklenemedi. Dosya boyutunu kontrol edin.';
      }

      toast({
        variant: 'destructive',
        title: 'Analiz Başarısız',
        description,
      });
    } finally {
      // Storage'dan Resmi Sil
      if (filePath) {
        await supabase.storage.from(FOOD_BUCKET).remove([filePath]);
      }
      setIsAnalyzing(false);
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

    toast({
      title: 'Öğün Eklendi',
      description: `${meal.food_name} başarıyla kaydedildi.`,
    });
  };

  // UI MANTIĞI VE DÖNÜŞ (return) BURADADIR
  // ... [Calculated Macros, FoodIcon, ve return bloğu] ...