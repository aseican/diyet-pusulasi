import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/customSupabaseClient";
import {
  BarChart,
  Calendar,
  Droplets,
  Flame,
  Sparkles,
  TrendingUp,
  Dumbbell,
  Crown,
} from "lucide-react";

// -------------------- helpers --------------------
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

function n(x, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

function calcBMI(heightCm, weightKg) {
  const h = n(heightCm);
  const w = n(weightKg);
  if (!h || !w) return 0;
  return w / (h / 100) ** 2;
}

// -------------------- plan + limits --------------------
const normalizePlan = (plan) => {
  if (!plan) return "free";
  const p = plan.toString().trim().toLowerCase();
  if (["sub_unlimited_monthly", "kapsamli", "kapsamlı", "unlimited"].includes(p))
    return "sub_unlimited_monthly";
  if (["sub_pro_monthly", "pro"].includes(p)) return "sub_pro_monthly";
  if (["sub_premium_monthly", "premium", "basic"].includes(p))
    return "sub_premium_monthly";
  return "free";
};

const PLAN_LIMITS = {
  free: 0,
  sub_premium_monthly: 3,
  sub_pro_monthly: 10,
  sub_unlimited_monthly: Infinity,
};

const PLAN_LABELS = {
  free: "Free",
  sub_premium_monthly: "Premium",
  sub_pro_monthly: "Pro",
  sub_unlimited_monthly: "Kapsamlı",
};

const RangeButton = ({ active, children, onClick }) => (
  <Button
    onClick={onClick}
    variant={active ? "default" : "outline"}
    className={active ? "bg-emerald-600 hover:bg-emerald-700" : ""}
    size="sm"
  >
    {children}
  </Button>
);

// -------------------- UI components --------------------
const StatBox = ({ icon: Icon, title, value, subtitle }) => (
  <div className="rounded-2xl border p-4 bg-white shadow-sm">
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Icon className="w-4 h-4" />
      {title}
    </div>
    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
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

// -------------------- main --------------------
export const Progress = ({ userData }) => {
  const [range, setRange] = useState("7d"); // today | 7d | 30d
  const [loading, setLoading] = useState(false);

  const [meals, setMeals] = useState([]);
  const [waterCount, setWaterCount] = useState(0);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiRemaining, setAiRemaining] = useState(null);
  const [aiError, setAiError] = useState(null);

  const today = localYMD();

  const { startDate, endDate, daysCount } = useMemo(() => {
    if (range === "today") return { startDate: today, endDate: today, daysCount: 1 };
    if (range === "30d") return { startDate: addDays(today, -29), endDate: today, daysCount: 30 };
    return { startDate: addDays(today, -6), endDate: today, daysCount: 7 };
  }, [range, today]);

  // weight data
  const startWeight = n(userData?.start_weight);
  const currentWeight = n(userData?.weight);
  const targetWeight = n(userData?.target_weight);
  const weightChange = currentWeight - startWeight;

  const bmi = useMemo(() => {
    const v = calcBMI(userData?.height, currentWeight);
    return v ? Number(v.toFixed(1)) : 0;
  }, [userData?.height, currentWeight]);

  const daysPassed = useMemo(() => {
    const created = userData?.created_at ? new Date(userData.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) return 0;
    return Math.max(1, Math.ceil((new Date() - created) / (1000 * 60 * 60 * 24)));
  }, [userData?.created_at]);

  const planKey = normalizePlan(userData?.plan_tier);
  const maxDaily = PLAN_LIMITS[planKey] ?? 0;
  const canUseAi = maxDaily > 0;

  // Fetch meals & water
  useEffect(() => {
    const run = async () => {
      if (!userData?.id) return;

      setLoading(true);
      try {
        const { data: mealsData, error: mealsErr } = await supabase
          .from("added_meals")
          .select("id,date,food_name,meal_type,calories,protein,carbs,fat,quantity,unit,created_at")
          .eq("user_id", userData.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });

        if (mealsErr) throw mealsErr;
        setMeals(mealsData || []);

        // water_logs: 1 kayıt = 1 bardak
        const { data: waterData, error: waterErr } = await supabase
          .from("water_logs")
          .select("id")
          .eq("user_id", userData.id)
          .gte("date", startDate)
          .lte("date", endDate);

        if (waterErr) throw waterErr;
        setWaterCount((waterData || []).length);
      } catch (e) {
        console.error("[Progress] fetch failed:", e?.message || e);
        setMeals([]);
        setWaterCount(0);
      } finally {
        setLoading(false);
      }
    };

    run();
    // aralık değişince AI sonucu da resetleyelim (kafa karıştırmasın)
    setAiResult(null);
    setAiError(null);
  }, [userData?.id, startDate, endDate]);

  // Aggregations
  const stats = useMemo(() => {
    const totalCalories = (meals || []).reduce((s, m) => s + n(m.calories), 0);
    const totalP = (meals || []).reduce((s, m) => s + n(m.protein), 0);
    const totalC = (meals || []).reduce((s, m) => s + n(m.carbs), 0);
    const totalF = (meals || []).reduce((s, m) => s + n(m.fat), 0);

    const avgCalories = daysCount ? totalCalories / daysCount : 0;

    // Top foods (count)
    const foodMap = new Map();
    for (const m of meals || []) {
      const key = (m.food_name || "").trim() || "Bilinmeyen";
      foodMap.set(key, (foodMap.get(key) || 0) + 1);
    }
    const topFoods = Array.from(foodMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Daily calories series
    const dayMap = new Map();
    for (let i = 0; i < daysCount; i++) {
      const d = addDays(startDate, i);
      dayMap.set(d, 0);
    }
    for (const m of meals || []) {
      const d = (m.date || "").slice(0, 10);
      if (dayMap.has(d)) dayMap.set(d, dayMap.get(d) + n(m.calories));
    }
    const series = Array.from(dayMap.entries()).map(([d, kcal]) => ({
      date: d,
      kcal: Math.round(kcal),
    }));

    return {
      totalCalories,
      avgCalories,
      totalP,
      totalC,
      totalF,
      topFoods,
      series,
      totalWaterGlasses: waterCount,
    };
  }, [meals, daysCount, startDate, waterCount]);

  const calorieGoal = n(userData?.target_calories, 2000);
  const avgPct = calorieGoal ? Math.min((stats.avgCalories / calorieGoal) * 100, 999) : 0;

  const runAiInsight = async () => {
    if (!canUseAi || aiLoading) return;

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const payload = {
        range: { startDate, endDate, daysCount },
        stats: {
          totalCalories: Math.round(stats.totalCalories),
          avgCalories: Math.round(stats.avgCalories),
          totalWaterGlasses: stats.totalWaterGlasses,
          macros: {
            protein: Math.round(stats.totalP),
            carbs: Math.round(stats.totalC),
            fat: Math.round(stats.totalF),
          },
          topFoods: stats.topFoods,
          series: stats.series,
          calorieGoal: calorieGoal,
          weight: {
            current: n(userData?.weight),
            start: n(userData?.start_weight),
            target: n(userData?.target_weight),
          },
          user: {
            gender: userData?.gender || null,
            age: n(userData?.age),
            height: n(userData?.height),
            activity_level: userData?.activity_level || null,
            goal_type: userData?.goal_type || null,
          },
        },
        locale: "tr-TR",
      };

      const { data, error } = await supabase.functions.invoke("generate-progress-insights", {
        body: payload,
      });

      if (error) {
        // supabase-js error objesi bazen message taşır
        const msg = error?.message || "AI analiz alınamadı";
        // limit case: function 429 dönerse buraya genelde düşer
        if (msg.toLowerCase().includes("429") || msg.toLowerCase().includes("limit")) {
          setAiError("Günlük AI analiz hakkın doldu. Yarın yeniden deneyebilirsin.");
        } else {
          setAiError(msg);
        }
        return;
      }

      setAiResult(data?.insight || null);
      if (typeof data?.remaining === "number") setAiRemaining(data.remaining);
      if (data?.remaining === Infinity) setAiRemaining(Infinity);
    } catch (e) {
      setAiError(e?.message || "AI analiz alınamadı");
    } finally {
      setAiLoading(false);
    }
  };

  if (!userData) {
    return <div className="p-6 text-center text-gray-500">Yükleniyor...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      {/* Range Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Analiz Aralığı
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 items-center">
          <RangeButton active={range === "today"} onClick={() => setRange("today")}>
            Bugün
          </RangeButton>
          <RangeButton active={range === "7d"} onClick={() => setRange("7d")}>
            Son 7 Gün
          </RangeButton>
          <RangeButton active={range === "30d"} onClick={() => setRange("30d")}>
            Son 30 Gün
          </RangeButton>

          <div className="ml-auto text-xs text-gray-500">
            {loading ? "Yükleniyor..." : `${startDate} → ${endDate}`}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Premium Özet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              icon={Flame}
              title="Toplam Kalori"
              value={`${Math.round(stats.totalCalories)} kcal`}
              subtitle={`Günlük ort: ${Math.round(stats.avgCalories)} kcal (${Math.round(avgPct)}%)`}
            />
            <StatBox
              icon={Droplets}
              title="Su"
              value={`${stats.totalWaterGlasses} bardak`}
              subtitle="Bu aralıkta toplam"
            />
            <StatBox
              icon={Dumbbell}
              title="Makrolar"
              value={`P:${Math.round(stats.totalP)}g  K:${Math.round(stats.totalC)}g  Y:${Math.round(stats.totalF)}g`}
              subtitle="Toplam makro"
            />
            <div className="rounded-2xl border p-4 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BarChart className="w-4 h-4 text-emerald-600" />
                Günlük Trend
              </div>
              <div className="mt-2">
                <MiniBars series={stats.series} />
              </div>
              <div className="text-xs text-gray-500 mt-2">Kalori dağılımı</div>
            </div>
          </div>

          {stats.topFoods?.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-semibold text-gray-800 mb-2">En sık tükettiklerin</div>
              <div className="space-y-2">
                {stats.topFoods.map((f) => (
                  <div key={f.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{f.name}</span>
                    <span className="text-gray-500">{f.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Premium AI Insight */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Detaylı Analiz
          </CardTitle>

          <div className="text-xs text-gray-500 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-500" />
            {PLAN_LABELS[planKey] || "Free"}
            {canUseAi ? (
              <span>
                •{" "}
                {maxDaily === Infinity
                  ? "Limitsiz"
                  : aiRemaining != null
                  ? `Kalan: ${aiRemaining}`
                  : `Günlük: ${maxDaily}`}
              </span>
            ) : (
              <span>• Premium gerekli</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!canUseAi ? (
            <div className="rounded-2xl border p-4 bg-gray-50">
              <div className="font-semibold text-gray-900">Bu özellik Premium</div>
              <div className="text-sm text-gray-600 mt-1">
                Haftalık / aylık alışkanlık analizi, risk tespiti ve kişisel öneriler Premium üyelikle açılır.
              </div>
            </div>
          ) : (
            <>
              <Button
                onClick={runAiInsight}
                disabled={aiLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {aiLoading ? "Analiz hazırlanıyor..." : "AI ile Detaylı Analiz & Öneri Üret"}
              </Button>

              {aiError && (
                <div className="rounded-2xl border p-4 bg-red-50 text-sm text-red-700">
                  {aiError}
                </div>
              )}

              {aiResult && !aiError && (
                <div className="space-y-3">
                  {aiResult.summary && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Genel Durum</div>
                      <div className="text-sm text-gray-700 mt-1">{aiResult.summary}</div>
                    </div>
                  )}

                  {!!aiResult.highlights?.length && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Öne Çıkanlar</div>
                      <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                        {aiResult.highlights.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!aiResult.macro_analysis && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Makro Analizi</div>
                      <div className="text-sm text-gray-700 mt-2 space-y-2">
                        {aiResult.macro_analysis.protein && (
                          <div>
                            <b>Protein:</b> {aiResult.macro_analysis.protein}
                          </div>
                        )}
                        {aiResult.macro_analysis.carbs && (
                          <div>
                            <b>Karbonhidrat:</b> {aiResult.macro_analysis.carbs}
                          </div>
                        )}
                        {aiResult.macro_analysis.fat && (
                          <div>
                            <b>Yağ:</b> {aiResult.macro_analysis.fat}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {aiResult.hydration_analysis && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Su Analizi</div>
                      <div className="text-sm text-gray-700 mt-1">{aiResult.hydration_analysis}</div>
                    </div>
                  )}

                  {!!aiResult.behavior_patterns?.length && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Alışkanlık Desenleri</div>
                      <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                        {aiResult.behavior_patterns.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!aiResult.risks?.length && (
                    <div className="rounded-2xl border p-4 bg-amber-50 border-amber-200">
                      <div className="text-sm font-semibold text-amber-900">Dikkat Edilecek Noktalar</div>
                      <ul className="list-disc pl-5 text-sm text-amber-800 mt-2 space-y-1">
                        {aiResult.risks.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!aiResult.recommendations?.length && (
                    <div className="rounded-2xl border p-4 bg-emerald-50 border-emerald-200">
                      <div className="text-sm font-semibold text-emerald-900">Öneriler</div>
                      <ol className="list-decimal pl-5 text-sm text-emerald-900 mt-2 space-y-1">
                        {aiResult.recommendations.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {!!aiResult.next_week_plan?.length && (
                    <div className="rounded-2xl border p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">Gelecek Hafta Mini Plan</div>
                      <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                        {aiResult.next_week_plan.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Weight Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Kilo İlerlemesi</CardTitle>
          <BarChart className="h-5 w-5 text-emerald-500" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox icon={TrendingUp} title="Başlangıç" value={`${startWeight.toFixed(1)} kg`} />
            <StatBox icon={TrendingUp} title="Şimdi" value={`${currentWeight.toFixed(1)} kg`} />
            <StatBox icon={TrendingUp} title="Hedef" value={`${targetWeight.toFixed(1)} kg`} />
            <StatBox icon={TrendingUp} title="VKİ" value={`${bmi || 0}`} />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium">Toplam Değişim:</p>
            <p
              className={`text-2xl font-bold ${
                weightChange > 0
                  ? "text-red-500"
                  : weightChange < 0
                  ? "text-emerald-600"
                  : "text-gray-600"
              }`}
            >
              {weightChange.toFixed(1)} kg
            </p>
            <div className="text-xs text-gray-500 mt-1">Kaydedilen gün: {daysPassed}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
