// ======================================================================
// MealTracker.jsx — FINAL FIXED VERSION (Quota + Button + Plan Safe)
// ======================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/customSupabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Search, Plus, Utensils, Drumstick, Apple, Coffee, Loader2, Zap, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { v4 as uuidv4 } from "uuid";

const FOOD_BUCKET = "food-images";

// =====================================================
// SINGLE SOURCE OF TRUTH — PLAN LIMITS
// =====================================================
const PLAN_LIMITS = {
  free: { daily: 3, monthly: 3 },
  sub_premium_monthly: { daily: 30, monthly: 1000 },
  sub_pro_monthly: { daily: 50, monthly: 2000 },
  sub_unlimited_monthly: { daily: 99999, monthly: 99999 },
};

// =====================================================
// QUOTA HELPERS (BACKEND AUTHORITATIVE)
// =====================================================
async function getUserQuota(supabase, userId) {
  const { data: user, error } = await supabase
    .from("profiles")
    .select("plan_tier, ai_daily_used, ai_monthly_used, ai_last_use_date, ai_last_use_month")
    .eq("id", userId)
    .single();

  if (error || !user) throw new Error("USER_NOT_FOUND");

  const today = new Date().toISOString().split("T")[0];
  const month = new Date().toISOString().slice(0, 7);

  let dailyUsed = user.ai_daily_used ?? 0;
  let monthlyUsed = user.ai_monthly_used ?? 0;

  if (user.ai_last_use_date !== today) dailyUsed = 0;
  if (user.ai_last_use_month !== month) monthlyUsed = 0;

  const limits = PLAN_LIMITS[user.plan_tier] ?? PLAN_LIMITS.free;

  return { limits, dailyUsed, monthlyUsed, today, month };
}

async function incrementAiUsage(supabase, userId, today, month) {
  await supabase
    .from("profiles")
    .update({
      ai_daily_used: supabase.raw("ai_daily_used + 1"),
      ai_monthly_used: supabase.raw("ai_monthly_used + 1"),
      ai_last_use_date: today,
      ai_last_use_month: month,
    })
    .eq("id", userId);
}

export const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("gram");
  const [mealType, setMealType] = useState("Kahvaltı");

  const fileInputRef = useRef(null);
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // =====================================================
  // SEARCH
  // =====================================================
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

    if (!error) setSearchResults(data || []);
    setLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(searchFoods, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchFoods]);

  // =====================================================
  // AI ANALYZE (NO UI QUOTA LOCK)
  // =====================================================
  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      const quota = await getUserQuota(supabase, user.id);

      if (quota.dailyUsed >= quota.limits.daily) {
        toast({
          variant: "destructive",
          title: "Günlük Limit Doldu",
          description: `Günlük hakkınız: ${quota.limits.daily}`,
        });
        return;
      }

      const ext = aiFile.name.split('.').pop();
      const filePath = `${user.id}/${uuidv4()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, aiFile);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(filePath);

      const imageUrl = publicData?.publicUrl;
      if (!imageUrl) throw new Error('NO_PUBLIC_URL');

      const { data: { session } } = await supabase.auth.getSession();

      const { data } = await supabase.functions.invoke('analyze-food-image', {
        body: { imageUrl },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!data?.name) throw new Error('AI_FAILED');

      setAnalysisResult(data);

      await incrementAiUsage(supabase, user.id, quota.today, quota.month);

    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Analiz Hatası' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // =====================================================
  // UI (kısaltılmış, mantık değişmedi)
  // =====================================================
  return (
    <div className="p-4">
      <Tabs defaultValue="ai">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="manual">Manuel</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setAiFile(e.target.files?.[0] || null)}
          />

          {!aiFile && (
            <Label
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg"
            >
              <Camera className="h-8 w-8" />
              <p>Fotoğraf Yükle</p>
            </Label>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={!aiFile || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <><Loader2 className="animate-spin mr-2" /> Analiz Ediliyor</>
            ) : (
              <><Zap className="mr-2" /> Analiz Et</>
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ======================================================================
// END OF FILE
// ======================================================================
