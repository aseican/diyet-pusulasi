// ======================================================================
// MealTracker.jsx — ULTIMATE FINAL VERSION
// - Manuel ekleme
// - AI foto analiz (mobil + web)
// - Quota / plan uyumu
// - Premium ready
// - UI KORUNDU
// ======================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Camera,
  Zap,
  Loader2,
  Trash2,
  Utensils,
  Crown,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { v4 as uuidv4 } from 'uuid';

// =====================================================
// CONFIG
// =====================================================
const FOOD_BUCKET = 'food-images';

const PLAN_LIMITS = {
  free: 3,
  sub_premium_monthly: 30,
  sub_pro_monthly: 50,
  sub_unlimited_monthly: 99999,
};

// =====================================================
// HELPERS
// =====================================================
const todayStr = () => new Date().toISOString().split('T')[0];

const normalizePlan = (plan) => {
  if (!plan) return 'free';
  if (['kapsamli', 'unlimited', 'sub_unlimited_monthly'].includes(plan))
    return 'sub_unlimited_monthly';
  if (['pro', 'sub_pro_monthly'].includes(plan))
    return 'sub_pro_monthly';
  if (['premium', 'basic', 'sub_premium_monthly'].includes(plan))
    return 'sub_premium_monthly';
  return 'free';
};

// =====================================================
// COMPONENT
// =====================================================
function MealTracker({ meals = [], addMeal, deleteMeal }) {
  const { user } = useAuth();
  const { toast } = useToast();

  // ---------------- UI STATE ----------------
  const [activeTab, setActiveTab] = useState('manual');
  const [loading, setLoading] = useState(false);

  // ---------------- MANUAL ----------------
  const [searchTerm, setSearchTerm] = useState('');
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');
  const [showManualModal, setShowManualModal] = useState(false);

  // ---------------- AI ----------------
  const fileInputRef = useRef(null);
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // =====================================================
  // LOAD FOOD SEARCH
  // =====================================================
  const loadFoods = useCallback(async () => {
    if (searchTerm.length < 2) {
      setFoods([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('foods')
      .select('*')
      .ilike('name_tr', `%${searchTerm}%`)
      .limit(20);

    setFoods(data || []);
    setLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(loadFoods, 300);
    return () => clearTimeout(t);
  }, [loadFoods]);

  // =====================================================
  // MANUAL ADD
  // =====================================================
  const handleManualAdd = () => {
    if (!selectedFood) return;

    const multiplier = quantity / 100;

    addMeal({
      ...selectedFood,
      meal_type: mealType,
      quantity,
      unit,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: Math.round(selectedFood.protein * multiplier),
      carbs: Math.round(selectedFood.carbs * multiplier),
      fat: Math.round(selectedFood.fat * multiplier),
    });

    setShowManualModal(false);
    setSelectedFood(null);
    setQuantity(100);
  };

  // =====================================================
  // AI ANALYZE
  // =====================================================
  const handleAnalyze = async () => {
    if (!user || !aiFile || isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      // ---- profile + quota
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, ai_usage_count, ai_usage_last_reset')
        .eq('id', user.id)
        .single();

      const planKey = normalizePlan(profile?.plan_tier);
      const limit = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free;

      const today = todayStr();
      const used =
        profile?.ai_usage_last_reset === today
          ? profile.ai_usage_count
          : 0;

      if (used >= limit) {
        toast({
          variant: 'destructive',
          title: 'AI hakkın doldu',
          description: `Günlük limit: ${limit}`,
        });
        return;
      }

      // ---- upload image
      const ext = aiFile.name.split('.').pop();
      const path = `${user.id}/${uuidv4()}.${ext}`;

      await supabase.storage.from(FOOD_BUCKET).upload(path, aiFile, {
        contentType: aiFile.type,
      });

      const { data: urlData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      // ---- call edge function
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

      // ---- update usage
      await supabase
        .from('profiles')
        .update({
          ai_usage_count: used + 1,
          ai_usage_last_reset: today,
        })
        .eq('id', user.id);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'AI analiz başarısız',
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
          <TabsTrigger value="manual">
            <Utensils className="w-4 h-4 mr-2" />
            Manuel
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="w-4 h-4 mr-2" />
            AI
          </TabsTrigger>
        </TabsList>

        {/* ================= MANUAL ================= */}
        <TabsContent value="manual" className="space-y-4">
          <Input
            placeholder="Yiyecek ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading && <p className="text-sm">Yükleniyor…</p>}

          <AnimatePresence>
            {foods.map((food) => (
              <motion.div
                key={food.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between p-3 border rounded-lg"
              >
                <span>{food.name_tr}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedFood(food);
                    setShowManualModal(true);
                  }}
                >
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
            className="hidden"
            onChange={(e) =>
              setAiFile(e.target.files?.[0] || null)
            }
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2" />
            Fotoğraf Yükle
          </Button>

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
            <div className="p-4 border rounded-lg text-xs bg-gray-50">
              <pre>{JSON.stringify(analysisResult, null, 2)}</pre>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================= MANUAL MODAL ================= */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yiyecek Ekle</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Miktar</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) =>
                setQuantity(Number(e.target.value))
              }
            />

            <Label>Öğün</Label>
            <Select
              value={mealType}
              onValueChange={setMealType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Kahvaltı">
                  Kahvaltı
                </SelectItem>
                <SelectItem value="Öğle">
                  Öğle
                </SelectItem>
                <SelectItem value="Akşam">
                  Akşam
                </SelectItem>
                <SelectItem value="Ara Öğün">
                  Ara Öğün
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button onClick={handleManualAdd}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =====================================================
// EXPORT (BUILD SAFE)
// =====================================================
export { MealTracker };
export default MealTracker;
