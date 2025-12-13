import React from 'react';
import { motion } from 'framer-motion';
import CalorieRing from '@/components/CalorieRing';
import QuickStats from '@/components/QuickStats';
import WaterTracker from '@/components/WaterTracker';
import TodayMeals from '@/components/TodayMeals';

export const Dashboard = ({ userData, meals = [], updateUserData, deleteMeal }) => {
  const totalCalories = meals.reduce(
    (sum, meal) => sum + (Number(meal.calories) || 0),
    0
  );

  const calorieGoal = Number(userData?.target_calories) || 2000;

  return (
    <div className="px-4 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <CalorieRing current={totalCalories} goal={calorieGoal} meals={meals} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <QuickStats userData={userData} todayMeals={meals} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <WaterTracker userData={userData} updateUserData={updateUserData} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <TodayMeals meals={meals} deleteMeal={deleteMeal} />
      </motion.div>
    </div>
  );
};

export default Dashboard;
