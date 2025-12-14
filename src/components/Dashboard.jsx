import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import CalorieRing from "@/components/CalorieRing";
import QuickStats from "@/components/QuickStats";
import WaterTracker from "@/components/WaterTracker";
import TodayMeals from "@/components/TodayMeals";

// ✅ UTC kayması yok: local date (YYYY-MM-DD)
function localYMD(d = new Date()) {
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

export const Dashboard = ({ userData, meals = [], updateUserData, deleteMeal }) => {
  const [selectedDate, setSelectedDate] = useState(localYMD());

  // ✅ Gün değişince otomatik bugüne geç (app açık kalsa bile)
  useEffect(() => {
    const id = setInterval(() => {
      const now = localYMD();
      setSelectedDate((prev) => (prev === now ? prev : now));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ✅ Parent tüm meals’i yollasa bile burada bugüne filtrele
  const todayMeals = useMemo(() => {
    const arr = Array.isArray(meals) ? meals : [];
    return arr.filter((m) => {
      if (!m?.date) return true; // date yoksa parent zaten filtrelemeli (legacy)
      const d = typeof m.date === "string" ? m.date.slice(0, 10) : "";
      return d === selectedDate;
    });
  }, [meals, selectedDate]);

  const totalCalories = useMemo(() => {
    return todayMeals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  }, [todayMeals]);

  const calorieGoal = Number(userData?.target_calories) || 2000;

  return (
    <div className="px-4 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <CalorieRing current={totalCalories} goal={calorieGoal} meals={todayMeals} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <QuickStats userData={userData} todayMeals={todayMeals} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <WaterTracker userData={userData} updateUserData={updateUserData} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* ✅ TodayMeals'e selectedDate verdim, güvenlik filtresi orada da var */}
        <TodayMeals meals={todayMeals} selectedDate={selectedDate} deleteMeal={deleteMeal} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
