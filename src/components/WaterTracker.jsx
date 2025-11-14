import React from "react";
import { motion } from "framer-motion";
import { Droplets, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const WaterTracker = ({ userData, updateUserData }) => {
  const { toast } = useToast();

  if (!userData) {
    return null;
  }

  const waterIntake = userData.water_intake || 0; // glasses
  const waterGoal = userData.daily_water_goal || 8; // glasses

  const addWater = () => {
    const newIntake = waterIntake + 1;
    updateUserData({ water_intake: newIntake });

    if (newIntake === waterGoal) {
      toast({
        title: "Tebrikler! 🎉",
        description: "Günlük su hedefini tamamladın!",
      });
    }
  };

  const removeWater = () => {
    if (waterIntake > 0) {
      updateUserData({ water_intake: waterIntake - 1 });
    }
  };
  
  const percentage = waterGoal > 0 ? Math.min((waterIntake / waterGoal) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          Su Takibi
        </h3>
        <span className="text-sm text-gray-500 font-medium">
          {waterIntake} / {waterGoal} bardak
        </span>
      </div>

      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={removeWater}
          variant="outline"
          size="sm"
          className="flex-1 border-gray-200 hover:bg-gray-50"
          disabled={waterIntake === 0}
        >
          <Minus className="w-4 h-4 mr-1" />
          Çıkar
        </Button>
        <Button
          onClick={addWater}
          size="sm"
          className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Ekle
        </Button>
      </div>
    </div>
  );
};

export default WaterTracker;