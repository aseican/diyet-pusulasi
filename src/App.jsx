import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Utensils, Zap, Scale } from 'lucide-react'; 

export const Dashboard = ({ userData, meals, updateUserData, deleteMeal }) => {
    // Toplam kalori hesaplama
    const totalCaloriesToday = meals
        .filter(meal => {
            // Meals verisi olmadığında hata almamak için tarih kontrolü
            const today = new Date().toDateString();
            const mealDate = new Date(meal.created_at).toDateString();
            return today === mealDate;
        })
        .reduce((sum, meal) => sum + meal.calories, 0);

    const targetCalories = userData?.target_calories || 2000;
    const remainingCalories = targetCalories - totalCaloriesToday;

    // Water Intake
    const waterIntake = userData?.water_intake || 0;
    const waterGoal = userData?.daily_water_goal || 8; 

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Hoş Geldin, {userData?.username || 'Kullanıcı'}!</h1>
            
            <div className="grid grid-cols-2 gap-4">
                {/* 1. Günlük Kalori Kartı */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Kalan Kalori</CardTitle>
                        <Zap className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{remainingCalories} kcal</div>
                        <p className="text-xs text-muted-foreground">Hedef: {targetCalories} kcal</p>
                    </CardContent>
                </Card>

                {/* 2. Su Takibi Kartı */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Su Takibi</CardTitle>
                        <Scale className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{waterIntake} / {waterGoal} Bardak</div>
                        <p className="text-xs text-muted-foreground">Su İçmeyi Unutma!</p>
                    </CardContent>
                </Card>
            </div>
            
            {/* 3. Öğün Listesi (Basitleştirilmiş) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Bugünün Öğünleri</CardTitle>
                </CardHeader>
                <CardContent>
                    {meals.length > 0 ? (
                        <ul className="space-y-2">
                            {meals.slice(0, 3).map((meal) => (
                                <li key={meal.id} className="flex justify-between text-sm">
                                    <span>{meal.name}</span>
                                    <span className="font-medium">{meal.calories} kcal</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">Bugün henüz öğün eklemedin.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};