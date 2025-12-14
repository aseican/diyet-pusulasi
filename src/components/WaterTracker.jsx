import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Droplets, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/customSupabaseClient";

// ✅ UTC kayması olmasın: local date (YYYY-MM-DD)
function localYMD(d = new Date()) {
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

const WaterTracker = ({ userData, updateUserData }) => {
  const { toast } = useToast();

  const userId = userData?.id;
  const waterGoal = userData?.daily_water_goal || 8; // bardak
  const glassMl = 250; // istersen userData’dan da çekebiliriz

  const [day, setDay] = useState(localYMD());
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ Gün değişince otomatik bugüne geç
  useEffect(() => {
    const id = setInterval(() => {
      const now = localYMD();
      setDay((prev) => (prev === now ? prev : now));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const fetchTodayWater = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // sadece bugünün loglarını al
      const { data, error } = await supabase
        .from("water_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("date", day);

      if (error) throw error;
      setTodayCount((data || []).length);
    } catch {
      // sessiz geçebiliriz; ama istersen toast
      // toast({ variant: "destructive", title: "Su verisi alınamadı" });
    } finally {
      setLoading(false);
    }
  }, [userId, day]);

  useEffect(() => {
    fetchTodayWater();
  }, [fetchTodayWater]);

  const addWater = async () => {
    if (!userId || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("water_logs").insert({
        user_id: userId,
        date: day,
        amount_ml: glassMl,
      });
      if (error) throw error;

      const newCount = todayCount + 1;
      setTodayCount(newCount);

      if (newCount === waterGoal) {
        toast({ title: "Tebrikler! 🎉", description: "Günlük su hedefini tamamladın!" });
      }
    } catch {
      toast({ variant: "destructive", title: "Su eklenemedi" });
    } finally {
      setLoading(false);
    }
  };

  const removeWater = async () => {
    if (!userId || loading || todayCount <= 0) return;

    setLoading(true);
    try {
      // bugünün son kaydını bul ve sil
      const { data: last, error: findErr } = await supabase
        .from("water_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("date", day)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!last?.id) {
        setTodayCount(0);
        return;
      }

      const { error: delErr } = await supabase.from("water_logs").delete().eq("id", last.id);
      if (delErr) throw delErr;

      setTodayCount((p) => Math.max(0, p - 1));
    } catch {
      toast({ variant: "destructive", title: "Su çıkarılamadı" });
    } finally {
      setLoading(false);
    }
  };

  const percentage = useMemo(() => {
    if (!waterGoal) return 0;
    return Math.min((todayCount / waterGoal) * 100, 100);
  }, [todayCount, waterGoal]);

  if (!userData) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          Su Takibi
        </h3>
        <span className="text-sm text-gray-500 font-medium">
          {todayCount} / {waterGoal} bardak
        </span>
      </div>

      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={removeWater}
          variant="outline"
          size="sm"
          className="flex-1 border-gray-200 hover:bg-gray-50"
          disabled={todayCount === 0 || loading}
        >
          <Minus className="w-4 h-4 mr-1" />
          Çıkar
        </Button>
        <Button
          onClick={addWater}
          size="sm"
          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          disabled={loading}
        >
          <Plus className="w-4 h-4 mr-1" />
          Ekle
        </Button>
      </div>

      {/* hedefi düzenlemek istiyorsan updateUserData ile kullanabileceğin alan */}
      {/* örn profil ekranında daily_water_goal güncelleniyor zaten */}
    </div>
  );
};

export default WaterTracker;
