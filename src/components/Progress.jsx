import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Crown,
  Lock,
  TrendingUp,
  Activity,
  Droplets,
  Flame,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/customSupabaseClient";

// ---------- helpers ----------
const isPremium = (plan) =>
  ["sub_premium_monthly", "sub_pro_monthly", "sub_unlimited_monthly"].includes(plan);

const planLabel = (plan) => {
  if (plan === "sub_unlimited_monthly") return "Kapsamlı";
  if (plan === "sub_pro_monthly") return "Pro";
  if (plan === "sub_premium_monthly") return "Premium";
  return "Free";
};

function localYMD(d = new Date()) {
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}
function ymdToDate(ymd) {
  const [y, m, d] = (ymd || "").split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}
function addDays(ymd, delta) {
  const dt = ymdToDate(ymd);
  dt.setDate(dt.getDate() + delta);
  return localYMD(dt);
}
const n = (x, fb = 0) => {
  const v = Number(x);
  return Number.isFinite(v) ? v : fb;
};
const calcBMI = (heightCm, weightKg) => {
  const h = n(heightCm);
  const w = n(weightKg);
  if (!h || !w) return 0;
  return w / (h / 100) ** 2;
};

// ---------- UI atoms ----------
const Pill = ({ active, children, onClick }) => (
  <Button
    size="sm"
    onClick={onClick}
    variant={active ? "default" : "outline"}
    className={active ? "bg-emerald-600 hover:bg-emerald-700" : ""}
  >
    {children}
  </Button>
);

const TinyStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border bg-white px-3 py-2 shadow-sm">
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <Icon className="w-4 h-4" />
      <span className="truncate">{label}</span>
    </div>
    <div className="text-base font-bold text-gray-900 mt-1 leading-none">{value}</div>
  </div>
);

const MiniBars = ({ series }) => {
  const max = Math.max(...(series || []).map((x) => x.kcal), 1);
  return (
    <div className="flex items-end gap-1 h-16 w-full">
      {(series || []).map((x) => (
        <div key={x.date} className="flex-1">
          <div
            className="w-full rounded-t bg-emerald-500/70"
            style={{ height: `${Math.max(6, (x.kcal / max) * 100)}%` }}
            title={`${x.date}: ${Math.round(x.kcal)} kcal`}
          />
        </div>
      ))}
    </div>
  );
};

// ---------- main ----------
export const Progress = ({ userData }) => {
  const [mode, setMode] = useState("week"); // week | month
  const [loading, setLoading] = useState(false);

  const [meals, setMeals] = useState([]);
  const [waterCount, setWaterCount] = useState(0);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);

  if (!userData) return <div className="p-6 text-center text-gray-500">Yükleniyor...</div>;

  const today = localYMD();
  const daysCount = mode === "month" ? 30 : 7;
  const startDate = mode === "month" ? addDays(today, -29) : addDays(today, -6);
  const endDate = today;

  const premium = isPremium(userData.plan_tier);

  // weight metrics
  const startWeight = n(userData.start_weight);
  const currentWeight = n(userData.weight);
  const targetWeight = n(userData.target_weight);
  const bmi = calcBMI(userData.height, currentWeight);
  const weightDiff = currentWeight - startWeight;

  // fetch meals + water for selected range
  useEffect(() => {
    const run = async () => {
      if (!userData?.id) return;
      setLoading(true);
      try {
        const { data: mealsData, error: mealsErr } = await supabase
          .from("added_meals")
          .select("id,date,calories,protein,carbs,fat,food_name,created_at")
          .eq("user_id", userData.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true });

        if (mealsErr) throw mealsErr;
        setMeals(mealsData || []);

        const { data: waterData, error: waterErr } = await supabase
          .from("water_logs")
          .select("id")
          .eq("user_id", userData.id)
          .gte("date", startDate)
          .lte("date", endDate);

        if (waterErr) throw waterErr;
        setWaterCount((waterData || []).length);
      } catch {
        setMeals([]);
        setWaterCount(0);
      } finally {
        setLoading(false);
      }
    };

    run();
    setAiResult(null);
    setAiError(null);
  }, [userData?.id, startDate, endDate]);

  const stats = useMemo(() => {
    const totalCalories = (meals || []).reduce((s, m) => s + n(m.calories), 0);
    const totalP = (meals || []).reduce((s, m) => s + n(m.protein), 0);
    const totalC = (meals || []).reduce((s, m) => s + n(m.carbs), 0);
    const totalF = (meals || []).reduce((s, m) => s + n(m.fat), 0);
    const avgCalories = totalCalories / daysCount;

    // daily series
    const dayMap = new Map();
    for (let i = 0; i < daysCount; i++) dayMap.set(addDays(startDate, i), 0);
    for (const m of meals || []) {
      const d = (m.date || "").slice(0, 10);
      if (dayMap.has(d)) dayMap.set(d, dayMap.get(d) + n(m.calories));
    }
    const series = Array.from(dayMap.entries()).map(([date, kcal]) => ({
      date,
      kcal: Math.round(kcal),
    }));

    return { totalCalories, avgCalories, totalP, totalC, totalF, series };
  }, [meals, daysCount, startDate]);

  const calorieGoal = n(userData.target_calories, 2000);
  const adherencePct = calorieGoal ? Math.min((stats.avgCalories / calorieGoal) * 100, 999) : 0;

  const runAI = async () => {
    if (!premium || aiLoading) return;

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const payload = {
        range: { startDate, endDate, daysCount },
        stats: {
          calorieGoal,
          totalCalories: Math.round(stats.totalCalories),
          avgCalories: Math.round(stats.avgCalories),
          adherencePct: Math.round(adherencePct),
          waterGlasses: waterCount,
          macros: {
            protein: Math.round(stats.totalP),
            carbs: Math.round(stats.totalC),
            fat: Math.round(stats.totalF),
          },
          weight: {
            start: startWeight,
            current: currentWeight,
            target: targetWeight,
            bmi: bmi ? Number(bmi.toFixed(1)) : 0,
          },
        },
        locale: "tr-TR",
      };

      const { data, error } = await supabase.functions.invoke("generate-progress-insights", {
        body: payload,
      });

      if (error) throw error;

      // function { insight: { summary, recommendations... } } döndürüyorsa:
      setAiResult(data?.insight || "Analiz üretilemedi.");
    } catch {
      // CORS vs olursa burası düşer
      setAiError("AI analizi şu anda oluşturulamadı. (CORS / Function yanıtı kontrol edilmeli)");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* ========= HERO AI ========= */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-purple-700 via-indigo-700 to-fuchsia-700 text-white overflow-hidden shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5" />
              AI Detaylı Analiz
              <span className="ml-auto flex items-center gap-2 text-xs bg-white/15 px-3 py-1 rounded-full">
                <Crown className="w-4 h-4 text-yellow-300" />
                {planLabel(userData.plan_tier)} • {premium ? "Aktif" : "Kilitli"}
              </span>
            </CardTitle>
            <div className="text-xs text-white/80">
              {mode === "month" ? "Son 30 gün" : "Son 7 gün"} verilerine göre kişisel analiz + öneri.
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {premium ? (
              <>
                <Button
                  onClick={runAI}
                  disabled={aiLoading}
                  className="w-full bg-white text-purple-800 hover:bg-gray-100 font-semibold"
                >
                  {aiLoading ? "AI analiz ediyor..." : "AI ile Analiz & Öneri Üret"}
                </Button>

                {aiError && (
                  <div className="rounded-xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl bg-white/10 border border-white/15 p-4 text-sm leading-relaxed"
                  >
                    {/* Eğer function JSON obje döndürüyorsa, güzel gösterelim */}
                    {typeof aiResult === "string" ? (
                      aiResult
                    ) : (
                      <div className="space-y-3">
                        {aiResult.summary && (
                          <div>
                            <div className="font-semibold text-white">Genel Durum</div>
                            <div className="text-white/90">{aiResult.summary}</div>
                          </div>
                        )}
                        {!!aiResult.recommendations?.length && (
                          <div>
                            <div className="font-semibold text-white">Öneriler</div>
                            <ul className="list-disc pl-5 text-white/90 space-y-1 mt-1">
                              {aiResult.recommendations.slice(0, 6).map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {!aiResult.summary && !aiResult.recommendations && (
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(aiResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-white/10 border border-white/15 p-5 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="font-semibold">Premium Özellik</div>
                <div className="text-sm text-white/85">
                  Haftalık / aylık alışkanlık analizi, risk tespiti ve kişisel öneriler premium üyelikle açılır.
                </div>
                <Button className="bg-white text-purple-800 hover:bg-gray-100 font-semibold">
                  Premium’a Geç
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ========= RANGE + PREMIUM SNAPSHOT ========= */}
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            Premium İlerleme Özeti
            <span className="ml-auto text-xs text-gray-500">
              {loading ? "Yükleniyor..." : `${startDate} → ${endDate}`}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Pill active={mode === "week"} onClick={() => setMode("week")}>Haftalık</Pill>
            <Pill active={mode === "month"} onClick={() => setMode("month")}>Aylık</Pill>
          </div>

          {/* küçük statlar */}
          <div className="grid grid-cols-2 gap-3">
            <TinyStat icon={Flame} label="Ortalama Kalori" value={`${Math.round(stats.avgCalories)} kcal`} />
            <TinyStat icon={Droplets} label="Su (Toplam)" value={`${waterCount} bardak`} />
            <TinyStat icon={Activity} label="Hedef Uyum" value={`${Math.round(adherencePct)}%`} />
            <TinyStat
              icon={TrendingUp}
              label="Makro (P/K/Y)"
              value={`${Math.round(stats.totalP)}/${Math.round(stats.totalC)}/${Math.round(stats.totalF)} g`}
            />
          </div>

          {/* mini trend */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-800">Kalori Trend</div>
              <div className="text-xs text-gray-500">{mode === "month" ? "30 gün" : "7 gün"}</div>
            </div>
            <MiniBars series={stats.series} />
            <div className="mt-2 text-xs text-gray-500">
              Toplam: <b>{Math.round(stats.totalCalories)} kcal</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========= WEIGHT PREMIUM CARDS ========= */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vücut Metrikleri</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <TinyStat icon={TrendingUp} label="Başlangıç" value={`${startWeight.toFixed(1)} kg`} />
          <TinyStat icon={TrendingUp} label="Şimdi" value={`${currentWeight.toFixed(1)} kg`} />
          <TinyStat icon={TrendingUp} label="Hedef" value={`${targetWeight.toFixed(1)} kg`} />
          <TinyStat icon={Activity} label="VKİ" value={bmi ? bmi.toFixed(1) : "—"} />

          <div className="col-span-2 rounded-2xl border bg-white p-4">
            <div className="text-xs text-gray-500">Toplam Değişim</div>
            <div
              className={`text-3xl font-extrabold mt-1 ${
                weightDiff < 0 ? "text-emerald-600" : "text-gray-800"
              }`}
            >
              {weightDiff.toFixed(1)} kg
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Takip süresi: <b>{Math.max(1, Math.ceil((new Date() - new Date(userData.created_at)) / (1000 * 60 * 60 * 24)))} gün</b>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
