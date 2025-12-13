// ======================================================================
// MealTracker.jsx — FINAL FULL VERSION (PC + MOBILE FIXED)
// ======================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Camera,
  Zap,
  Loader2,
  Plus,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// CONFIG
// =====================================================
const FOOD_BUCKET = 'food-images';

const PLAN_LIMITS = {
  free: { daily: 3 },
  sub_premium_monthly: { daily: 30 },
  sub_pro_monthly: { daily: 50 },
  sub_unlimited_monthly: { daily: 99999 },
};

// =====================================================
// IMAGE PROCESSOR (MOBILE FIX)
// =====================================================
const processImageForUpload = (file) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 1024;

      let { width, height } = img;
      if (width > height && width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob], 'food.jpg', {
              type: 'image/jpeg',
            })
          );
        },
        'image/jpeg',
        0.85
      );
    };
    img.src = URL.createObjectURL(file);
  });

// =====================================================
// COMPONENT
// =====================================================
function MealTracker({ addMeal }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('manual');

  // MANUAL
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // AI
  const [aiFile, setAiFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // =====================================================
  // MANUAL SEARCH
  // =====================================================
  const searchFoods = useCallback(async () => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('foods')
      .select('*')
      .ilike('name_tr', `%${searchTerm}%`)
      .limit(20);

    setSearchResults(data || []);
    setLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(searchFoods, 300);
    return () => clearTimeout(t);
  }, [searchFoods]);

  // =====================================================
  // AI ANALYZE
  // =====================================================
  const handleAnalyze = async () => {
    if (!user || !aiFile || isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, ai_daily_used, ai_last_use_date')
        .eq('id', user.id)
        .single();

      const today = new Date().toISOString().split('T')[0];
      let dailyUsed = profile?.ai_daily_used || 0;
      if (profile?.ai_last_use_date !== today) dailyUsed = 0;

      const limit =
        PLAN_LIMITS[profile?.plan_tier]?.daily ??
        PLAN_LIMITS.free.daily;

      if (dailyUsed >= limit) {
        toast({
          variant: 'destructive',
          title: 'AI Limit Doldu',
          description: `Günlük hakkınız: ${limit}`,
        });
        return;
      }

      // PROCESS IMAGE (MOBILE FIX)
      const processedFile = await processImageForUpload(aiFile);

      const path = `${user.id}/${uuidv4()}.jpg`;

      await supabase.storage
        .from(FOOD_BUCKET)
        .upload(path, processedFile, {
          contentType: 'image/jpeg',
        });

      const { data: urlData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke(
        'analyze-food-image',
        {
          body: { imageUrl },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      setAnalysisResult(data);

      await supabase
        .from('profiles')
        .update({
          ai_daily_used: dailyUsed + 1,
          ai_last_use_date: today,
        })
        .eq('id', user.id);

    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'AI Analiz Hatası',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="p-4 space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="manual">Manuel</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>

        {/* ================= MANUAL ================= */}
        <TabsContent value="manual" className="space-y-4">
          <Input
            placeholder="Yiyecek ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading && <p>Yükleniyor...</p>}

          <AnimatePresence>
            {searchResults.map((food) => (
              <motion.div
                key={food.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-emerald-600" />
                  <span>{food.name_tr}</span>
                </div>
                <Button size="sm" onClick={() => addMeal(food)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </TabsContent>

        {/* ================= AI ================= */}
        <TabsContent value="ai" className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAiFile(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2" /> Fotoğraf Yükle
          </Button>

          {previewUrl && (
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Camera className="w-5 h-5 text-emerald-600" />
              <span className="text-sm truncate">
                {aiFile?.name || 'Seçilen fotoğraf'}
              </span>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={!aiFile || isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Zap className="mr-2" />
            )}
            Analiz Et
          </Button>

          {analysisResult && (
            <div className="p-4 border rounded-lg text-xs">
              <pre>{JSON.stringify(analysisResult, null, 2)}</pre>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =====================================================
// EXPORTS (BUILD SAFE)
// =====================================================
export { MealTracker };
export default MealTracker;
