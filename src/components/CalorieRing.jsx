import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Apple, Drumstick, Cookie } from 'lucide-react';

const CalorieRing = ({ current, goal, meals }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  const remaining = Math.max(goal - current, 0);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const macros = meals.reduce((acc, meal) => ({
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fat: acc.fat + (meal.fat || 0),
  }), { protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5" />
        Günlük Kalori
      </h2>
      
      <div className="flex items-center justify-between">
        <div className="relative w-48 h-48">
          <svg className="transform -rotate-90 w-48 h-48">
            <circle
              cx="96"
              cy="96"
              r="90"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="12"
              fill="none"
            />
            <motion.circle
              cx="96"
              cy="96"
              r="90"
              stroke="white"
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p 
              className="text-4xl font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              {current}
            </motion.p>
            <p className="text-sm opacity-90">/ {goal} kcal</p>
            <p className="text-xs mt-1 opacity-75">{remaining} kalan</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Drumstick className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs opacity-75">Protein</p>
              <p className="font-semibold">{macros.protein}g</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs opacity-75">Karbonhidrat</p>
              <p className="font-semibold">{macros.carbs}g</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Apple className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs opacity-75">Yağ</p>
              <p className="font-semibold">{macros.fat}g</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalorieRing;