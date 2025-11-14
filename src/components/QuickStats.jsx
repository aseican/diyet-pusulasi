import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Target, Flame } from 'lucide-react';

const QuickStats = ({ userData, todayMeals }) => {
  const currentWeight = userData?.weight || 0;
  const targetWeight = userData?.target_weight || 0;
  const targetCalories = userData?.target_calories || 2000;

  const totalCalories = todayMeals?.reduce((sum, meal) => sum + (meal.calories || 0), 0) || 0;
  const remainingCalories = targetCalories - totalCalories;

  const stats = [
    {
      icon: Scale,
      label: 'Mevcut Kilo',
      value: `${currentWeight.toFixed(1)} kg`,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: Target,
      label: 'Hedef Kilo',
      value: `${targetWeight.toFixed(1)} kg`,
      color: 'from-purple-500 to-violet-600',
    },
    {
      icon: Flame,
      label: 'Kalan Kalori',
      value: `${remainingCalories > 0 ? remainingCalories : 0}`,
      unit: 'kcal',
      color: 'from-orange-500 to-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-gradient-to-br ${stat.color} rounded-2xl p-4 text-white shadow-lg flex flex-col`}
        >
          <stat.icon className="w-6 h-6 mb-2 opacity-90" />
          <p className="text-xs opacity-90 mb-1 flex-grow">{stat.label}</p>
          <p className="text-lg font-bold">{stat.value} <span className="text-xs opacity-90">{stat.unit}</span></p>
        </motion.div>
      ))}
    </div>
  );
};

export default QuickStats;