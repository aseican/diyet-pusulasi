import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Crown,
  TrendingDown,
  TrendingUp,
  Activity,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/customSupabaseClient";

// ---------------- UTIL ----------------
const isPremium = (plan) =>
  ["sub_premium_monthly", "sub_pro_monthly", "sub_unlimited_monthly"].includes(
    plan
  );

// ---------------- MAIN ----------------
export const Progress = ({ userData }) => {
  const [aiResult, setAiResult] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState(null);

  if (!userData) return null;

  const startWeight = Number(userData.start_weight || 0);
  const currentWeight = Number(userData.weight || 0);
  const targetWeight = Number(userData.target_weight || 0);

  const weightDiff = currentWeight - startWeight;
  const bmi =
    userData.height && currentWeight
      ? (currentWeight / ((userData.height / 100) ** 2)).toFixed(1)
      : "—";

  const daysPassed = Math.max(
    1,
    Math.ceil(
      (new Date() - new Date(userData.created_at)) / (1000 * 60 * 60 * 24)
    )
  );

  // ---------------- AI CALL ----------------
  const generateAIInsight = async () => {
    setLoadingAI(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-progress-insights",
        {
          body: {},
        }
      );

      if (error) throw error;
      setAiResult(data?.insight || "Analiz üretilemedi.");
    } catch (e) {
      setError("AI analizi şu anda oluşturulamadı.");
    } finally {
      setLoadingAI(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="p-4 space-y-6">
      {/* ================= AI HERO ================= */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-purple-600 via-indigo-600 to-fuchsia-600 text-white overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5" />
              AI Detaylı Vücut Analizi
              {isPremium(userData.plan_tier) && (
                <span className="ml-auto flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                  <Crown className="w-3 h-3" />
                  Premium
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {isPremium(userData.plan_tier) ? (
              <>
                <Button
                  onClick={generateAIInsight}
                  disabled={loadingAI}
                  className="w-full bg-white text-purple-700 hover:bg-gray-100 font-semibold"
                >
                  {loadingAI
                    ? "AI analiz ediyor..."
                    : "AI ile Detaylı Analiz & Öneri Üret"}
                </Button>

                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/10 rounded-xl p-4 text-sm leading-relaxed"
                  >
                    {aiResult}
                  </motion.div>
                )}

                {error && (
                  <div className="bg-red-500/20 text-red-100 rounded-lg p-3 text-sm">
                    {error}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <Lock className="w-8 h-8 opacity-80" />
                <p className="text-sm opacity-90">
                  Bu analiz premium üyelere özeldir.
                </p>
                <Button className="bg-white text-purple-700">
                  Premium’a Geç
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Başlangıç"
          value={`${startWeight.toFixed(1)} kg`}
          icon={<TrendingDown />}
        />
        <StatCard
          title="Şu An"
          value={`${currentWeight.toFixed(1)} kg`}
          icon={<TrendingUp />}
        />
        <StatCard
          title="Hedef"
          value={`${targetWeight.toFixed(1)} kg`}
          icon={<Activity />}
        />
        <StatCard title="VKİ" value={bmi} icon={<Activity />} />
      </div>

      {/* ================= SUMMARY ================= */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <p className="text-sm text-muted-foreground">Toplam Değişim</p>
          <p
            className={`text-3xl font-bold ${
              weightDiff < 0 ? "text-emerald-600" : "text-gray-700"
            }`}
          >
            {weightDiff.toFixed(1)} kg
          </p>
          <p className="text-xs text-muted-foreground">
            {daysPassed} gündür takip ediliyor
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------- SUB ----------------
const StatCard = ({ title, value, icon }) => (
  <Card>
    <CardContent className="pt-5 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        {title}
      </div>
      <div className="text-xl font-bold">{value}</div>
    </CardContent>
  </Card>
);
