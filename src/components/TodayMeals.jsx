import React from 'react';
import { motion } from 'framer-motion';
import { Coffee, Sun, Moon, Zap, Trash2, Utensils } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from './ui/button';

const mealTypeConfig = {
  'Kahvaltı': { icon: Coffee, color: 'text-yellow-600' },
  'Öğle Yemeği': { icon: Sun, color: 'text-orange-500' },
  'Akşam Yemeği': { icon: Moon, color: 'text-indigo-500' },
  'Atıştırmalık': { icon: Zap, color: 'text-green-500' },
};

const TodayMeals = ({ meals, deleteMeal }) => {
  const handleDelete = (mealId) => {
    deleteMeal(mealId);
  };

  const mealsByType = Object.keys(mealTypeConfig).map(typeName => {
    const config = mealTypeConfig[typeName];
    const items = meals?.filter(meal => meal.meal_type === typeName) || [];
    return {
      name: typeName,
      ...config,
      items: items,
      totalCalories: items.reduce((sum, item) => sum + item.calories, 0),
    };
  });

  const totalCalories = meals?.reduce((sum, meal) => sum + meal.calories, 0) || 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Utensils className="w-5 h-5 text-emerald-600" />
          Bugünün Öğünleri
        </h3>
        <span className="font-bold text-lg text-emerald-600">{Math.round(totalCalories)} kcal</span>
      </div>

      {mealsByType.map((mealType) => (
        (mealType.items.length > 0) && (
          <motion.div
            key={mealType.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="border-t pt-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className={`font-semibold flex items-center gap-2 ${mealType.color}`}>
                <mealType.icon className="w-5 h-5" />
                {mealType.name}
              </h4>
              <span className="text-sm font-medium text-gray-600">{Math.round(mealType.totalCalories)} kcal</span>
            </div>

            <ul className="space-y-2">
              {mealType.items.map((item) => (
                <li key={item.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex-grow">
                    <p className="font-medium text-gray-800">{item.food_name}</p>
                    <p className="text-sm text-gray-500">{Math.round(item.calories)} kcal • {item.quantity} {item.unit}</p>
                    <div className="flex gap-x-3 text-xs text-gray-400 mt-1">
                        <span>P: {item.protein.toFixed(1)}g</span>
                        <span>K: {item.carbs.toFixed(1)}g</span>
                        <span>Y: {item.fat.toFixed(1)}g</span>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu eylem geri alınamaz. "{item.food_name}" öğesini günlüğünüzden kalıcı olarak silecektir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-red-600 hover:bg-red-700">Sil</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          </motion.div>
        )
      ))}

      {(!meals || meals.length === 0) && (
          <div className="text-center py-8 text-gray-500">
              <p>Bugün henüz bir şey yemedin.</p>
              <p className="text-sm">Hadi bir öğün ekleyerek başla!</p>
          </div>
      )}
    </div>
  );
};

export default TodayMeals;