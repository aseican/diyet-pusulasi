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

export const MealTracker = ({ addMeal }) => { // Export const olarak düzelttik
  const { toast } = useToast();
  const { user, userData } = useAuth();
  
  // --- MANUEL GİRİŞ STATE'LERİ ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');

  // --- AI GİRİŞ STATE'LERİ ---
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null); 
  
  // === FIX: KOTA LİMİTİNİ ANA KAPSAMA TAŞIMA (CRASH'İ ÇÖZER) ===
  const quotaLimit = userData?.plan_tier === 'basic' ? 3 : userData?.plan_tier === 'pro' ? 7 : Infinity;
  // ==========================================================

  // ... [Geri kalan kodlarınız aynı kalır] ...
  
  const searchFoods = useCallback(async () => {
    // ... (Sizin arama mantığınız)
  }, [searchTerm, toast]);

  useEffect(() => {
    // ... (Sizin debouce mantığınız)
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

    // === KOTA KONTROLÜ (quotaLimit artık yukarıdan geliyor) ===
    const currentQuota = userData?.ai_usage_count || 0; 
    
    if (userData?.plan_tier !== 'kapsamli' && currentQuota >= quotaLimit) { // Hata veren yer burasıydı
        toast({ variant: 'destructive', title: 'Limit Doldu', description: `Günlük ${quotaLimit} hakkınızı kullandınız. Lütfen planınızı yükseltin.` });
        setIsAnalyzing(false);
        return;
    }
    // ... [Geri kalan Edge Function çağırma mantığı aynı kalır] ...

    let publicUrl = null;
    let filePath = null;
    
    try {
        // ... (Supabase Storage ve Edge Function çağırma mantığı) ...
        
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
      // ... (AI ile öğün ekleme mantığı) ...
  };

  // ... [Geri kalan UI kodu aynı kalır] ...

  return (
    <div className="p-4 space-y-6">
      {/* ... [UI'ınızın geri kalanı] ... */}
      
        <TabsContent value="ai" className="space-y-4 p-4 bg-white rounded-b-lg shadow-lg">
            {/* ... (AI Sonuçları gösterimi) ... */}
            
            {!analysisResult && (
                <div className="space-y-3 pt-2">
                    {/* ... (Yükleme butonu ve metinleri) ... */}
                    
                    <p className="text-xs text-muted-foreground pt-2 text-center">
                        Kalan hakkınız: {userData?.plan_tier === 'kapsamli' ? 'Sınırsız' : `${userData?.ai_usage_count || 0} / ${quotaLimit}`}.
                    </p>
                </div>
            )}
        </TabsContent>
        {/* ... [Diğer tab'ler ve modal] ... */}
    </div>
  );
};