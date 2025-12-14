import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  X,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { v4 as uuidv4 } from "uuid";

const FOOD_BUCKET = "food-images";

function safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function guessExtFromMime(mime) {
  const t = (mime || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "jpg";
}

function todayYMD() {
  return new Date().toISOString().split("T")[0];
}

function monthYM() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeTier(tierRaw) {
  const t = (tierRaw || "free").toString().trim().toLowerCase();
  // Türkçe karakter/boşluk varyasyonlarını normalize et
  // kapsamlı / kapsamli / Kapsamlı gibi
  const noSpaces = t.replace(/\s+/g, "");
  const trFixed = noSpaces
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
  return trFixed;
}

// Plan limitleri
const PLAN_LIMITS = {
  free: { daily: 3, monthly: 3 },
  basic: { daily: 10, monthly: 30 },
  pro: { daily: 20, monthly: 60 },
  kapsamli: { daily: 99999, monthly: 99999 },

  // Google Play ürün ID’leri
  sub_premium_monthly: { daily: 30, monthly: 1000 },
  sub_pro_monthly: { daily: 50, monthly: 2000 },
  sub_unlimited_monthly: { daily: 99999, monthly: 99999 },
};

async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

async function checkAndUpdateQuota(userId) {
  const profile = await fetchProfile(userId);

  const tier = normalizeTier(profile.plan_tier);
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

  const today = todayYMD();
  const month = monthYM();

  let dailyUsed = safeNumber(profile.ai_daily_used, 0);
  let monthlyUsed = safeNumber(profile.ai_monthly_used, 0);

  // günlük reset
  if (profile.ai_last_use_date !== today) {
    dailyUsed = 0;
    await supabase.from("profiles").update({ ai_daily_used: 0, ai_last_use_date: today }).eq("id", userId);
  }

  // aylık reset
  if (profile.ai_last_use_month !== month) {
    monthlyUsed = 0;
    await supabase.from("profiles").update({ ai_monthly_used: 0, ai_last_use_month: month }).eq("id", userId);
  }

  if (dailyUsed >= limits.daily) return { allowed: false, reason: "DAILY_LIMIT_REACHED", limits, dailyUsed, monthlyUsed, profile };
  if (monthlyUsed >= limits.monthly) return { allowed: false, reason: "MONTHLY_LIMIT_REACHED", limits, dailyUsed, monthlyUsed, profile };

  return { allowed: true, limits, dailyUsed, monthlyUsed, profile };
}

async function incrementAiUsage(userId) {
  const profile = await fetchProfile(userId);

  const today = todayYMD();
  const month = monthYM();

  const daily = safeNumber(profile.ai_daily_used, 0) + 1;
  const monthly = safeNumber(profile.ai_monthly_used, 0) + 1;

  await supabase
    .from("profiles")
    .update({
      ai_daily_used: daily,
      ai_monthly_used: monthly,
      ai_last_use_date: today,
      ai_last_use_month: month,
    })
    .eq("id", userId);

  return { daily, monthly, today, month };
}

async function normalizeImageFileIfNeeded(file) {
  if (!file) return file;

  const name = file?.name || "";
  const type = (file?.type || "").toLowerCase();
  const isHeic =
    type.includes("image/heic") ||
    type.includes("image/heif") ||
    /\.heic$/i.test(name) ||
    /\.heif$/i.test(name);

  if (!isHeic) return file;

  try {
    const mod = await import("heic2any");
    const heic2any = mod?.default || mod;

    const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    const jpegName = name && name.includes(".") ? name.replace(/\.(heic|heif)$/i, ".jpg") : `photo_${Date.now()}.jpg`;
    return new File([jpegBlob], jpegName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function getMultiplier(unit, quantity, food) {
  let totalGram = 0;

  switch (unit) {
    case "gram":
      totalGram = quantity;
      break;
    case "adet":
      totalGram = quantity * (food.unit_gram || 100);
      break;
    case "porsiyon":
      totalGram = quantity * (food.portion_gram || 200);
      break;
    case "bardak":
      totalGram = quantity * 200;
      break;
    case "kasik":
      totalGram = quantity * 15;
      break;
    default:
      totalGram = quantity;
  }

  return totalGram / 100;
}

export function MealTracker({ addMeal }) {
  const { toast } = useToast();
  const { user } = useAuth();

  // -------- Tabs (controlled + persist) --------
 const PERSIST_MEALTRACKER_TAB = false; // ✅ bunu false bırak: app açılışını asla etkilemesin

const TAB_KEY = "dp_mealtracker_tab_v1";

const [tab, setTab] = useState(() => {
  if (!PERSIST_MEALTRACKER_TAB) return "manual";
  try {
    return localStorage.getItem(TAB_KEY) || "manual";
  } catch {
    return "manual";
  }
});

const setTabPersist = (v) => {
  setTab(v);
  if (!PERSIST_MEALTRACKER_TAB) return;
  try {
    localStorage.setItem(TAB_KEY, v);
  } catch {}
};


  // -------- Profile / Quota (live) --------
  const [profileTier, setProfileTier] = useState("free");
  const [dailyUsed, setDailyUsed] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [limits, setLimits] = useState(PLAN_LIMITS.free);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const p = await fetchProfile(user.id);
      const tier = normalizeTier(p.plan_tier);
      const lim = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

      setProfileTier(tier);
      setLimits(lim);
      setDailyUsed(safeNumber(p.ai_daily_used, 0));
      setMonthlyUsed(safeNumber(p.ai_monthly_used, 0));
    } catch {
      // sessiz geç
    }
  }, [user?.id]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const remainingDaily = Math.max(0, (limits?.daily ?? 0) - dailyUsed);
  const isQuotaReached = remainingDaily <= 0;

  // -------- Manual --------
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("gram");
  const [mealType, setMealType] = useState("Kahvaltı");

  const searchFoods = useCallback(async () => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    const { data, error } = await supabase
      .from("foods")
      .select("id, name_tr, calories, protein, carbs, fat, unit_gram, portion_gram, category")
      .ilike("name_tr", `%${q}%`)
      .limit(50);

    if (error) {
      toast({
        variant: "destructive",
        title: "Arama Hatası",
        description: "Yiyecekler aranırken bir hata oluştu.",
      });
      setSearchResults([]);
    } else {
      setSearchResults(data || []);
    }

    setLoadingSearch(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    const t = setTimeout(searchFoods, 250);
    return () => clearTimeout(t);
  }, [searchTerm, searchFoods]);

  const handleAddMealManual = () => {
    if (!selectedFood) return;

    const qty = safeNumber(quantity, 0);
    if (!qty || qty <= 0) {
      toast({ variant: "destructive", title: "Eksik Bilgi", description: "Lütfen miktarı giriniz." });
      return;
    }

    const multiplier = getMultiplier(unit, qty, selectedFood);

    const meal = {
      meal_type: mealType,
      food_name: selectedFood.name_tr,
      calories: safeNumber(selectedFood.calories) * multiplier,
      protein: safeNumber(selectedFood.protein) * multiplier,
      carbs: safeNumber(selectedFood.carbs) * multiplier,
      fat: safeNumber(selectedFood.fat) * multiplier,
      quantity: qty,
      unit,
      user_id: user?.id,
      date: todayYMD(),
    };

    addMeal(meal);

    setSelectedFood(null);
    setSearchTerm("");
    setSearchResults([]);

    toast({ title: "Öğün Eklendi", description: `${meal.food_name} başarıyla eklendi.` });
  };

  // -------- AI (Blob) --------
  const fileInputRef = useRef(null);

  const [aiBlob, setAiBlob] = useState(null); // Blob | File
  const [aiMeta, setAiMeta] = useState(null); // {name,type,size}
  const [previewUrl, setPreviewUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const nativeAvailable = useMemo(() => !!window?.NativeImage?.pickImageFromGallery, []);

  useEffect(() => {
    if (!aiBlob) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(aiBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [aiBlob]);

  // Native callback
  useEffect(() => {
    const receive = async (b64, mime) => {
      try {
        if (!b64) {
          toast({ title: "Foto seçilmedi" });
          return;
        }
        const safeMime = mime || "image/jpeg";
        const res = await fetch(`data:${safeMime};base64,${b64}`);
        const blob = await res.blob();
        if (!blob || !blob.size) {
          toast({ variant: "destructive", title: "Foto okunamadı" });
          return;
        }

        const ext = guessExtFromMime(safeMime);
        const name = `photo_${Date.now()}.${ext}`;

        setAiBlob(blob);
        setAiMeta({ name, type: safeMime, size: blob.size });
        setAnalysisResult(null);

        // ✅ Foto seçilince AI tabına geç + persist
        setTabPersist("ai");
        toast({ title: "Foto seçildi" });
      } catch {
        toast({ variant: "destructive", title: "Foto işlenemedi" });
      }
    };

    const aliases = [
      "__nativeImagePickResult",
      "nativeImagePickResult",
      "onNativeImagePickResult",
      "onImagePicked",
      "onImagePickResult",
      "receiveNativeImage",
      "NativeImagePickResult",
    ];
    for (const k of aliases) window[k] = receive;

    window.NativeImage = window.NativeImage || {};
    window.NativeImage.onImagePicked = receive;
    window.NativeImage.onResult = receive;

    if (window.__nativeImagePickBuffer?.b64) {
      const { b64, mime } = window.__nativeImagePickBuffer;
      window.__nativeImagePickBuffer = null;
      receive(b64, mime);
    }
  }, [toast]);

  const removePhoto = () => {
    setAiBlob(null);
    setAiMeta(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ Tek giriş noktası: “Yemek Fotoğrafı Yükle”
  // Native varsa native açar, yoksa input açar
  const openPhotoPicker = () => {
    if (nativeAvailable) {
      try {
        window.NativeImage.pickImageFromGallery();
        return;
      } catch {
        // native patlarsa web input fallback
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const normalized = await normalizeImageFileIfNeeded(f);

    setAiBlob(normalized);
    setAiMeta({
      name: normalized.name || `photo_${Date.now()}.jpg`,
      type: normalized.type || "image/jpeg",
      size: normalized.size || 0,
    });
    setAnalysisResult(null);

    // ✅ Dosya seçilince AI tabında kal
    setTabPersist("ai");
  };

  const uploadBlobToSupabase = async (blob, meta, userId) => {
    const mime = meta?.type || "image/jpeg";
    const ext = guessExtFromMime(mime);
    const fileName = `${uuidv4()}.${ext}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from(FOOD_BUCKET).upload(filePath, blob, {
      contentType: mime,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(filePath);
    const imageUrl = publicData?.publicUrl;
    if (!imageUrl) throw new Error("PUBLIC_URL_FAIL");
    return imageUrl;
  };

  const handleAnalyze = async () => {
    if (!aiBlob || !aiMeta || !user?.id || isAnalyzing) return;

    // quota kontrol + profile normalize
    try {
      const quota = await checkAndUpdateQuota(user.id);

      // UI state’ini canlı profile ile senkronla
      const tier = normalizeTier(quota.profile?.plan_tier);
      const lim = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
      setProfileTier(tier);
      setLimits(lim);
      setDailyUsed(safeNumber(quota.dailyUsed, 0));
      setMonthlyUsed(safeNumber(quota.monthlyUsed, 0));

      if (!quota.allowed) {
        toast({
          variant: "destructive",
          title: "Limit Doldu",
          description: quota.reason === "DAILY_LIMIT_REACHED" ? "Günlük AI kullanım hakkınız doldu." : "Aylık AI kullanım hakkınız doldu.",
        });
        return;
      }
    } catch {
      toast({ variant: "destructive", title: "Limit Kontrol Hatası" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const imageUrl = await uploadBlobToSupabase(aiBlob, aiMeta, user.id);

      const { data: sessionWrap } = await supabase.auth.getSession();
      const session = sessionWrap?.session;
      if (!session?.access_token) throw new Error("NO_SESSION");

      const { data, error } = await supabase.functions.invoke("analyze-food-image", {
        body: { imageUrl },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      setAnalysisResult(data);

      // ✅ Kullanımı DB’de artır + UI’da anında güncelle
      const updated = await incrementAiUsage(user.id);
      setDailyUsed((p) => p + 1); // anında düşsün
      setMonthlyUsed((p) => p + 1);

      // Sonra sync istersek:
      // await refreshProfile();
    } catch {
      toast({ variant: "destructive", title: "Analiz Hatası", description: "Analiz yapılamadı." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmMealFromAI = () => {
    if (!analysisResult || !user?.id) return;

    const meal = {
      meal_type: mealType,
      food_name: analysisResult?.name || "Bilinmeyen",
      calories: safeNumber(analysisResult?.calories, 0),
      protein: safeNumber(analysisResult?.protein, 0),
      carbs: safeNumber(analysisResult?.carbs, 0),
      fat: safeNumber(analysisResult?.fat, 0),
      quantity: safeNumber(analysisResult?.quantity, 1),
      unit: analysisResult?.unit || "adet",
      user_id: user.id,
      date: todayYMD(),
    };

    addMeal(meal);
    setAnalysisResult(null);
    removePhoto();

    toast({ title: "Öğün Eklendi", description: `${meal.food_name} kaydedildi.` });
  };

  const FoodIcon = ({ category }) => {
    const p = { className: "w-6 h-6 text-emerald-600" };
    if (category === "kahvalti") return <Coffee {...p} />;
    if (category === "ana_yemek") return <Drumstick {...p} />;
    if (category === "ara_ogun") return <Apple {...p} />;
    return <Utensils {...p} />;
  };

  const calculatedMacros = selectedFood
    ? (() => {
        const qty = safeNumber(quantity, 0);
        const multiplier = getMultiplier(unit, qty, selectedFood);
        return {
          calories: (safeNumber(selectedFood.calories) * multiplier).toFixed(0),
          protein: (safeNumber(selectedFood.protein) * multiplier).toFixed(1),
          carbs: (safeNumber(selectedFood.carbs) * multiplier).toFixed(1),
          fat: (safeNumber(selectedFood.fat) * multiplier).toFixed(1),
        };
      })()
    : null;

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Öğün Ekle</h1>
        <p className="text-gray-500">Manuel ekle veya fotoğrafla analiz et.</p>
      </motion.div>

      <Tabs value={tab} onValueChange={setTabPersist} className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Manuel Arama</TabsTrigger>
          <TabsTrigger value="ai">
            <Zap className="h-4 w-4 mr-1" /> Yapay Zeka
          </TabsTrigger>
        </TabsList>

        {/* MANUEL */}
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
              {loadingSearch ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="animate-spin text-emerald-600 w-6 h-6" />
                </div>
              ) : (
                searchResults.map((food) => (
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
                        <p className="text-sm text-gray-500">{food.calories} kcal</p>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-emerald-600" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {!loadingSearch && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
            <p className="text-center text-sm text-gray-500">Sonuç bulunamadı.</p>
          )}
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai" className="p-4 space-y-4 bg-white shadow rounded-b-lg">
          {/* hidden input (web fallback) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {analysisResult ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">Analiz Sonucu: {analysisResult?.name}</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-100 rounded-lg">
                  Kcal: <span className="font-bold text-emerald-600">{safeNumber(analysisResult?.calories, 0)}</span>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">Protein: {safeNumber(analysisResult?.protein, 0)}g</div>
                <div className="p-3 bg-gray-100 rounded-lg">Karbonhidrat: {safeNumber(analysisResult?.carbs, 0)}g</div>
                <div className="p-3 bg-gray-100 rounded-lg">Yağ: {safeNumber(analysisResult?.fat, 0)}g</div>
                <div className="col-span-2 p-3 bg-gray-100 rounded-lg">
                  Miktar: {safeNumber(analysisResult?.quantity, 1)} {analysisResult?.unit || "adet"}
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
              {/* Upload Card (single entry point) */}
              {!aiBlob ? (
                <button
                  type="button"
                  onClick={openPhotoPicker}
                  className="w-full cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-emerald-300 border-dashed rounded-lg hover:bg-emerald-50 active:scale-[0.99] transition"
                >
                  <Camera className="h-8 w-8 text-emerald-500" />
                  <p className="mt-2 font-medium text-emerald-700">Yemek Fotoğrafı Yükle</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nativeAvailable ? "Galeriden seç" : "Dosya seç"}
                  </p>
                </button>
              ) : (
                <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{aiMeta?.name}</p>
                      <p className="text-xs text-gray-500">{aiMeta?.size ? `${aiMeta.size} bytes` : ""}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" variant="outline" onClick={openPhotoPicker}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Değiştir
                      </Button>
                      <Button type="button" variant="outline" onClick={removePhoto} className="border-red-500 text-red-600 hover:bg-red-50">
                        <X className="h-4 w-4 mr-1" /> Kaldır
                      </Button>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="rounded-lg overflow-hidden border bg-white">
                      <img src={previewUrl} alt="Seçilen foto" className="w-full max-h-56 object-cover" />
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={!aiBlob || isAnalyzing || isQuotaReached}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
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

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Plan: <b>{profileTier}</b>
                </span>
                <span>
                  Kalan hak: <b>{remainingDaily}</b>
                </span>
              </div>

              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={refreshProfile} className="text-xs">
                  Yenile
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MANUEL MODAL */}
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
    </div>
  );
}
