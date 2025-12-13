// ======================================================================
// MealTracker.jsx — FINAL STABLE VERSION
// - UI KORUNDU
// - MOBİL DONMA FIX
// - FOTO SEÇİLDİ GÖSTERİMİ
// - AI + QUOTA STABLE
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
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = 'food-images';

// =====================================================
// PLAN LIMITS
// =====================================================
const PLAN_LIMITS = {
  free: 3,
  sub_premium_monthly: 30,
  sub_pro_monthly: 50,
  sub_unlimited_monthly: 99999,
};

// =====================================================
// COMPONENT
// =====================================================
function MealTracker({ addMeal }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('manual');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // AI
  const fileInputRef = useRef(null);
  const [aiFile, setAiFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // =====================================================
  // MANUEL ARAMA
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
  // AI ANALYZE (MOBİL STABLE)
  // =====================================================
  const handleAnalyze = async () => {
    if (!user || !aiFile || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // ---- PROFİL & KOTA ----
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, ai_daily_used, ai_last_use_date')
        .eq('id', user.id)
        .single();

      const today = new Date().toISOString().split('T')[0];
      let used = profile?.ai_daily_used || 0;
      if (profile?.ai_last_use_date !== today) used = 0;

      const limit = PLAN_LIMITS[profile?.plan_tier] ?? PLAN_LIMITS.free;

      if (used >= limit) {
        toast({
          variant: 'destructive',
          title: 'AI Limiti Doldu',
          description: `Günlük hak: ${limit}`,
        });
        return;
      }

      // ---- FOTO UPLOAD (MOBİL DONMA YOK) ----
      const path = `${user.id}/${uuidv4()}-${aiFile.name}`;

      await supabase.storage
        .from(FOOD_BUCKET)
        .upload(path, aiFile, {
          contentType: aiFile.type || 'image/jpeg',
        });

      const { data: urlData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(path);

      const imageUrl = urlData?.publicUrl;
      if (!imageUrl) throw new Error('Image URL alınamadı');

      // ---- EDGE FUNCTION ----
      const { data: sessionData } = await supabase.auth.getSession();

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 25000);

      const { data, error } = await supabase.functions.invoke(
        'analyze-food-image',
        {
          body: { imageUrl },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          signal: controller.signal,
        }
      );

      if (error) throw error;

      setAnalysisResult(data);

      // ---- KOTA GÜNCELLE ----
      await supabase
        .from('profiles')
        .update({
          ai_daily_used: used + 1,
          ai_last_use_date: today,
        })
        .eq('id', user.id);

    } catch (err) {
      if (err.name === 'AbortError') {
        toast({
          variant: 'destructive',
          title: 'Analiz zaman aşımı',
          description: 'Lütfen tekrar deneyin',
        });
      } else {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'AI Analiz Hatası',
        });
      }
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

        {/* ================= MANUEL ================= */}
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
                className="p-3 border rounded-lg flex justify-between"
              >
                <span>{food.name_tr}</span>
                <Button size="sm" onClick={() => addMeal(food)}>
                  Ekle
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

          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Camera className="mr-2" /> Fotoğraf Yükle
          </Button>

          {previewUrl && (
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Camera className="w-5 h-5 text-emerald-600" />
              <span className="text-sm truncate">
                {aiFile?.name}
              </span>
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={!aiFile || isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                Analiz ediliyor...
              </>
            ) : (
              <>
                <Zap className="mr-2" />
                Analiz Et
              </>
            )}
          </Button>

          {analysisResult && (
            <div className="p-4 border rounded-lg">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =====================================================
// EXPORTS
// =====================================================
export { MealTracker };
export default MealTracker;
