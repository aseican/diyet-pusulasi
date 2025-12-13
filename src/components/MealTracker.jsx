// ======================================================================
//                        FIXED & STABLE MealTracker.jsx
// ======================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/customSupabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Plus,
  Utensils,
  Drumstick,
  Apple,
  Coffee,
  Loader2,
  Zap,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
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

// -----------------------------
// PLAN LIMITS (DB kolonlarına göre)
// -----------------------------
const PLAN_LIMITS = {
  free: { daily: 3, monthly: 3 },
  basic: { daily: 10, monthly: 30 },
  pro: { daily: 20, monthly: 60 },
  kapsamli: { daily: 99999, monthly: 99999 },

  // Google Play productId’ler
  sub_premium_monthly: { daily: 30, monthly: 1000 },
  sub_pro_monthly: { daily: 50, monthly: 2000 },
  sub_unlimited_monthly: { daily: 99999, monthly: 99999 },
};

// -----------------------------
// QUOTA CHECK + RESET (profiles kolonlarına göre)
// Beklenen kolonlar:
// - plan_tier
// - ai_daily_used
// - ai_monthly_used
// - ai_last_use_date  (YYYY-MM-DD)
// - ai_last_use_month (YYYY-MM)
// -----------------------------
async function checkAndUpdateQuota(supabaseClient, userId) {
  const { data: user, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !user) return { allowed: false, reason: "USER_NOT_FOUND" };

  const today = new Date().toISOString().split("T")[0];
  const month = new Date().toISOString().slice(0, 7);

  const limits = PLAN_LIMITS[user.plan_tier] || PLAN_LIMITS.free;

  let dailyUsed = user.ai_daily_used ?? 0;
  let monthlyUsed = user.ai_monthly_used ?? 0;

  // Günlük reset
  if (user.ai_last_use_date !== today) {
    dailyUsed = 0;
    await supabaseClient
      .from("profiles")
      .update({ ai_daily_used: 0, ai_last_use_date: today })
      .eq("id", userId);
  }

  // Aylık reset
  if (user.ai_last_use_month !== month) {
    monthlyUsed = 0;
    await supabaseClient
      .from("profiles")
      .update({ ai_monthly_used: 0, ai_last_use_month: month })
      .eq("id", userId);
  }

  // Limit kontrol
  if (dailyUsed >= limits.daily)
    return { allowed: false, reason: "DAILY_LIMIT_REACHED", quota: { dailyUsed, limits } };

  if (monthlyUsed >= limits.monthly)
    return { allowed: false, reason: "MONTHLY_LIMIT_REACHED", quota: { monthlyUsed, limits } };

  return { allowed: true, quota: { dailyUsed, monthlyUsed, limits }, user };
}

async function incrementAiUsage(supabaseClient, userId) {
  const { data: user, error } = await supabaseClient
    .from("profiles")
    .select("ai_daily_used, ai_monthly_used")
    .eq("id", userId)
    .single();

  if (error || !user) return;

  const today = new Date().toISOString().split("T")[0];
  const month = new Date().toISOString().slice(0, 7);

  const daily = (user.ai_daily_used ?? 0) + 1;
  const monthly = (user.ai_monthly_used ?? 0) + 1;

  await supabaseClient
    .from("profiles")
    .update({
      ai_daily_used: daily,
      ai_monthly_used: monthly,
      ai_last_use_date: today,
      ai_last_use_month: month,
    })
    .eq("id", userId);
}

// -----------------------------
// Optional: HEIC normalize (istersen sonra ekleriz)
// Şimdilik direkt file döndürüyoruz (stabil olsun)
// -----------------------------
async function normalizeImageFile(file) {
  return file;
}

export const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const { user, userData } = useAuth();

  // ✅ Tabs state (kalıcı + stabil)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem("mealtracker_activeTab") || "manual";
    } catch {
      return "manual";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("mealtracker_activeTab", activeTab);
    } catch {}
  }, [activeTab]);

  // Kullanıcı planı (UI için)
  const currentPlan = userData?.plan_tier || "free";
  const quotaLimit = PLAN_LIMITS[currentPlan]?.daily ?? PLAN_LIMITS.free.daily;
  const currentQuota = Number(userData?.ai_daily_used ?? 0);
  const isQuotaReached = currentQuota >= quotaLimit;

  // STATE'LER
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("gram");
  const [mealType, setMealType] = useState("Kahvaltı");

  // AI FOTOĞRAF STATE
  const fileInputRef = useRef(null);
  const [aiFile, setAiFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // AI debug logs
  const [aiDebugLogs, setAiDebugLogs] = useState([]);
  const [showAiDebug, setShowAiDebug] = useState(false);

  const debugLog = useCallback((label, data) => {
    const ts = new Date().toISOString();
    const line =
      typeof data === "undefined"
        ? `[${ts}] ${label}`
        : `[${ts}] ${label} ${(() => {
            try {
              return JSON.stringify(data);
            } catch {
              return String(data);
            }
          })()}`;

    // console
    // eslint-disable-next-line no-console
    console.log(line);

    // on-screen
    setAiDebugLogs((prev) => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const clearDebug = useCallback(() => setAiDebugLogs([]), []);

  const copyDebugToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(aiDebugLogs.join("\n"));
      toast({ title: "Kopyalandı", description: "Debug logları panoya kopyalandı." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Kopyalanamadı",
        description: "Panoya kopyalanamadı (izin engeli olabilir).",
      });
    }
  }, [aiDebugLogs, toast]);

  // ✅ Foto seçilince AI tab’a kilitle (geri dönme hissini bitirir)
  useEffect(() => {
    if (aiFile) setActiveTab("ai");
  }, [aiFile]);

  // ✅ Native Android picker callback: window.__nativeImagePickResult(b64, mime)
  useEffect(() => {
    window.__nativeImagePickResult = (b64, mime) => {
      try {
        if (!b64) {
          debugLog("Native pick cancelled / empty");
          return;
        }

        const byteChars = atob(b64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }

        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: mime || "image/jpeg",
        });

        const ext = (mime?.split("/")?.[1] || "jpg").toLowerCase();
        const file = new File([blob], `native_photo.${ext}`, {
          type: mime || "image/jpeg",
        });

        debugLog("Native file constructed", { name: file.name, type: file.type, size: file.size });

        setAiFile(file);
        setAnalysisResult(null);
        setActiveTab("ai");

        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        debugLog("Native pick decode failed", { message: e?.message, name: e?.name });
      }
    };

    return () => {
      // cleanup (optional)
      // eslint-disable-next-line no-underscore-dangle
      window.__nativeImagePickResult = undefined;
    };
  }, [debugLog]);

  // =====================================================
  //                     SEARCH FOODS
  // =====================================================
  const searchFoods = useCallback(async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("foods")
      .select("id, name_tr, calories, protein, carbs, fat, unit_gram, category")
      .ilike("name_tr", `%${searchTerm}%`)
      .limit(50);

    if (error) {
      toast({
        variant: "destructive",
        title: "Arama Hatası",
        description: "Yiyecekler aranırken bir hata oluştu.",
      });
    } else {
      setSearchResults(data || []);
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
  const getMultiplier = (unitValue, qty, food) => {
    let totalGram = 0;

    switch (unitValue) {
      case "gram":
        totalGram = qty;
        break;
      case "adet":
        totalGram = qty * (food.unit_gram || 100);
        break;
      case "porsiyon":
        totalGram = qty * 200;
        break;
      case "bardak":
        totalGram = qty * 200;
        break;
      case "kasik":
        totalGram = qty * 15;
        break;
      default:
        totalGram = qty;
    }

    // foods tablosu 100g bazlı ise:
    return totalGram / 100;
  };

  const handleAddMealManual = () => {
    if (!selectedFood) return;

    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      toast({
        variant: "destructive",
        title: "Eksik Bilgi",
        description: "Lütfen miktarı giriniz.",
      });
      return;
    }

    const mult = getMultiplier(unit, qty, selectedFood);

    const meal = {
      meal_type: mealType,
      food_name: selectedFood.name_tr,
      calories: Number((selectedFood.calories ?? 0) * mult),
      protein: Number((selectedFood.protein ?? 0) * mult),
      carbs: Number((selectedFood.carbs ?? 0) * mult),
      fat: Number((selectedFood.fat ?? 0) * mult),
      quantity: qty,
      unit,
      user_id: user.id,
      date: new Date().toISOString().split("T")[0],
    };

    addMeal(meal);

    setSelectedFood(null);
    setSearchTerm("");
    setSearchResults([]);

    toast({
      title: "Öğün Eklendi",
      description: `${meal.food_name} başarıyla eklendi.`,
    });
  };

  // =====================================================
  //                     AI ANALYZE
  // =====================================================
  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      setAiFile(e.target.files[0]);
      setAnalysisResult(null);
      setActiveTab("ai");
    }
  };

  const removePhoto = () => {
    setAiFile(null);
    setAnalysisResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openNativePickerIfExists = () => {
    try {
      // Android WebView bridge: NativeImage.pickImageFromGallery()
      if (window?.NativeImage?.pickImageFromGallery) {
        debugLog("Calling native gallery picker");
        window.NativeImage.pickImageFromGallery();
        return true;
      }
    } catch (e) {
      debugLog("Native picker call failed", { message: e?.message });
    }
    return false;
  };

  const handleAnalyze = async () => {
    if (!aiFile || !user || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    // 1) quota
    const quota = await checkAndUpdateQuota(supabase, user.id);
    if (!quota.allowed) {
      toast({
        variant: "destructive",
        title: "Limit Doldu",
        description:
          quota.reason === "DAILY_LIMIT_REACHED"
            ? "Günlük AI kullanım hakkınız doldu."
            : "Aylık AI kullanım hakkınız doldu.",
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      // 2) upload
      const normalizedFile = await normalizeImageFile(aiFile);

      const safeName = normalizedFile?.name || aiFile?.name || "";
      const extFromName = safeName.includes(".") ? safeName.split(".").pop() : null;
      const extFromType = (normalizedFile?.type || aiFile?.type || "")
        .split("/")[1]
        ?.trim();
      const ext = (extFromName || extFromType || "jpg").toLowerCase();

      const fileName = `${uuidv4()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      debugLog("Selected file", {
        name: safeName,
        type: normalizedFile?.type || aiFile?.type,
        size: normalizedFile?.size || aiFile?.size,
      });

      debugLog("Uploading to storage", {
        bucket: FOOD_BUCKET,
        filePath,
        ext,
        contentType: normalizedFile?.type || aiFile?.type || "image/jpeg",
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, normalizedFile, {
          contentType: normalizedFile?.type || aiFile?.type || "image/jpeg",
          upsert: false,
          cacheControl: "3600",
        });

      debugLog("Upload result", {
        ok: !uploadError,
        uploadData,
        uploadError: uploadError?.message || uploadError,
      });

      if (uploadError) throw uploadError;

      // 3) public URL
      const { data: publicData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(filePath);
      const imageUrl = publicData?.publicUrl;
      if (!imageUrl) throw new Error("PUBLIC_URL_FAIL");

      // 4) session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      debugLog("Session check", { hasSession: !!session, hasToken: !!session?.access_token });
      if (!session?.access_token) throw new Error("NO_SESSION");

      // 5) invoke function
      debugLog("Invoking function", { fn: "analyze-food-image", imageUrlLen: imageUrl.length });

      const { data, error } = await supabase.functions.invoke("analyze-food-image", {
        body: { imageUrl },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      debugLog("Function response", {
        ok: !error,
        error: error?.message || error,
        dataKeys: data && typeof data === "object" ? Object.keys(data) : typeof data,
      });

      if (error) throw error;

      setAnalysisResult(data);

      // 6) increment usage
      await incrementAiUsage(supabase, user.id);
    } catch (err) {
      debugLog("Analyze error (catch)", {
        message: err?.message,
        name: err?.name,
        status: err?.status,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
      });

      setShowAiDebug(true);

      toast({
        variant: "destructive",
        title: "Analiz Hatası",
        description: "Analiz yapılamadı. (Detaylar için Debug Logları açın)",
      });
    }

    setIsAnalyzing(false);
  };

  const handleConfirmMealFromAI = () => {
    if (!analysisResult || !user) return;

    const meal = {
      meal_type: mealType,
      food_name: analysisResult.name ?? "Bilinmeyen",
      calories: Number(analysisResult.calories ?? 0),
      protein: Number(analysisResult.protein ?? 0),
      carbs: Number(analysisResult.carbs ?? 0),
      fat: Number(analysisResult.fat ?? 0),
      quantity: Number(analysisResult.quantity ?? 1),
      unit: analysisResult.unit ?? "adet",
      user_id: user.id,
      date: new Date().toISOString().split("T")[0],
    };

    addMeal(meal);

    setAnalysisResult(null);
    setAiFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    toast({
      title: "Öğün Eklendi",
      description: `${meal.food_name} başarıyla kaydedildi.`,
    });
  };

  // =====================================================
  //                        UI helpers
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
        const qty = Number(quantity) || 0;
        const mult = getMultiplier(unit, qty, selectedFood);
        return {
          calories: ((selectedFood.calories ?? 0) * mult).toFixed(0),
          protein: ((selectedFood.protein ?? 0) * mult).toFixed(1),
          carbs: ((selectedFood.carbs ?? 0) * mult).toFixed(1),
          fat: ((selectedFood.fat ?? 0) * mult).toFixed(1),
        };
      })()
    : null;

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
        <p className="text-gray-500">Geniş veritabanından yiyecek arayın veya fotoğrafla analiz edin.</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Manuel Arama</TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-1" /> Yapay Zeka
          </TabsTrigger>
        </TabsList>

        {/* MANUEL ARAMA TAB */}
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
            <AnimatePresence>
              {loading ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="animate-spin text-emerald-600 w-6 h-6" />
                </div>
              ) : (
                (searchResults || []).map((food) => (
                  <motion.div
                    key={food.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      setSelectedFood(food);
                      setQuantity(100);
                      setUnit("gram");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <FoodIcon category={food.category} />
                      <div>
                        <p className="font-semibold">{food.name_tr}</p>
                        <p className="text-sm text-gray-500">{food.calories} kcal (100g)</p>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-emerald-600" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {!loading && (searchResults || []).length === 0 && searchTerm.trim().length >= 2 && (
            <p className="text-center text-sm text-gray-500">Sonuç bulunamadı.</p>
          )}
        </TabsContent>

        {/* AI TAB */}
        <TabsContent value="ai" className="p-4 space-y-4 bg-white shadow rounded-b-lg">
          {isQuotaReached && !analysisResult ? (
            <div className="text-center p-6 bg-red-50 border border-red-300 rounded-lg">
              <Zap className="mx-auto h-8 w-8 text-red-500" />
              <h3 className="font-semibold text-red-600 mt-2">Günlük Limit Doldu</h3>
              <p className="text-sm text-red-700">Günlük hakkınız: {quotaLimit}</p>
              <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">Premium’a Yükselt</Button>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">Analiz Sonucu: {analysisResult.name}</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-100 rounded-lg">
                  Kcal: <span className="font-bold text-emerald-600">{analysisResult.calories}</span>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">Protein: {analysisResult.protein}g</div>
                <div className="p-3 bg-gray-100 rounded-lg">Karbonhidrat: {analysisResult.carbs}g</div>
                <div className="p-3 bg-gray-100 rounded-lg">Yağ: {analysisResult.fat}g</div>
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
          ) : (
            <div className="space-y-3">
              {/* GİZLİ INPUT */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                id="upload-ai"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* DEBUG BUTONLARI */}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAiDebug(true)} className="flex-1">
                  Debug Logları
                </Button>
                <Button type="button" variant="outline" onClick={clearDebug} className="flex-1">
                  Temizle
                </Button>
              </div>

              {/* Native picker butonu (Android WebView bridge varsa) */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const ok = openNativePickerIfExists();
                  if (!ok) {
                    // native yoksa normal file picker
                    document.getElementById("upload-ai")?.click();
                  }
                }}
                className="w-full"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Galeriden Foto Seç
              </Button>

              {/* Fotoğraf yükleme alanı */}
              {!aiFile && (
                <Label
                  htmlFor="upload-ai"
                  className="cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-emerald-300 border-dashed rounded-lg hover:bg-emerald-50"
                >
                  <Camera className="h-8 w-8 text-emerald-500" />
                  <p className="mt-2 font-medium text-emerald-700">Yemek Fotoğrafı Yükle</p>
                </Label>
              )}

              {/* Foto seçildiyse */}
              {aiFile && (
                <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-gray-50">
                  <p className="font-medium text-gray-800 text-sm">{aiFile.name}</p>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Değiştir
                    </Button>

                    <Button variant="outline" onClick={removePhoto} className="border-red-500 text-red-600 hover:bg-red-50">
                      Kaldır
                    </Button>
                  </div>
                </div>
              )}

              {/* Analiz butonu */}
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
            Kalan hakkınız: {Math.max(0, quotaLimit - currentQuota)}
          </p>
        </TabsContent>
      </Tabs>

      {/* MANUEL EKLEME MODAL */}
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
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <div className="w-32">
                <Label>Birim</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
                <p className="font-medium">
                  Kalori: <b>{calculatedMacros.calories} kcal</b>
                </p>
                <p>Protein: {calculatedMacros.protein} g</p>
                <p>Karbonhidrat: {calculatedMacros.carbs} g</p>
                <p>Yağ: {calculatedMacros.fat} g</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleAddMealManual} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Öğün Olarak Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI DEBUG DIALOG */}
      <Dialog open={showAiDebug} onOpenChange={setShowAiDebug}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Debug Logları</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copyDebugToClipboard}>
              Kopyala
            </Button>
            <Button type="button" variant="outline" onClick={clearDebug}>
              Temizle
            </Button>
          </div>

          <div className="mt-3 max-h-[50vh] overflow-auto rounded-md border bg-gray-50 p-3">
            <pre className="whitespace-pre-wrap text-xs leading-5">
              {aiDebugLogs.length ? aiDebugLogs.join("\n") : "Henüz log yok."}
            </pre>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Mobilde console&apos;a erişemiyorsanız buradan kopyalayıp bana/ekibinize atabilirsiniz.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ======================================================================
//                            END OF FILE
// ======================================================================
