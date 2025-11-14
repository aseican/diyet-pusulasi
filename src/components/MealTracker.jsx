import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Utensils, Drumstick, Apple, Coffee, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

const MealTracker = ({ addMeal }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('gram');
  const [mealType, setMealType] = useState('Kahvaltı');

  const searchFoods = useCallback(async () => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('foods')
      .select('id, name_tr, calories, protein, carbs, fat, gram, category')
      .ilike('name_tr', `%${searchTerm.trim()}%`)
      .limit(50);

    if (error) {
      console.error('Error searching foods:', error);
      toast({ variant: 'destructive', title: 'Arama Hatası', description: 'Yiyecekler aranırken bir hata oluştu.' });
    } else {
      setSearchResults(data);
    }
    setLoading(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchFoods();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, searchFoods]);

  const getMultiplier = (unit, food) => {
    const servingSize = food.gram || 100;
    switch(unit) {
      case 'gram': return 1 / 100;
      case 'adet': return (servingSize / 100);
      case 'porsiyon': return (servingSize / 100);
      case 'bardak': return 2; // ~200g / 100g
      case 'kasik': return 0.15; // ~15g / 100g
      default: return 1 / 100;
    }
  };

  const handleAddMeal = () => {
    if (!selectedFood) return;

    const multiplier = getMultiplier(unit, selectedFood);
    const totalMultiplier = quantity * multiplier;
    
    const mealData = {
        food_id: selectedFood.id,
        food_name: selectedFood.name_tr,
        quantity: quantity,
        unit: unit,
        meal_type: mealType,
        calories: Math.round(selectedFood.calories * totalMultiplier),
        protein: parseFloat((selectedFood.protein * totalMultiplier).toFixed(1)),
        carbs: parseFloat((selectedFood.carbs * totalMultiplier).toFixed(1)),
        fat: parseFloat((selectedFood.fat * totalMultiplier).toFixed(1)),
    };

    addMeal(mealData);

    toast({
      title: 'Başarılı! 🎉',
      description: `${mealData.food_name} öğününüze eklendi.`,
    });
    setSelectedFood(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const calculatedMacros = selectedFood ? (() => {
    const multiplier = getMultiplier(unit, selectedFood);
    const totalMultiplier = quantity * multiplier;
    return {
        calories: (selectedFood.calories * totalMultiplier).toFixed(0),
        protein: (selectedFood.protein * totalMultiplier).toFixed(1),
        carbs: (selectedFood.carbs * totalMultiplier).toFixed(1),
        fat: (selectedFood.fat * totalMultiplier).toFixed(1),
    }
  })() : null;

  const FoodIcon = ({ category }) => {
    const lowerCategory = category?.toLowerCase() || '';
    if (lowerCategory.includes('yemek')) return <Utensils className="w-5 h-5 text-orange-600" />;
    if (lowerCategory.includes('atıştırmalık')) return <Apple className="w-5 h-5 text-green-600" />;
    if (lowerCategory.includes('meyve')) return <Apple className="w-5 h-5 text-red-500" />;
    if (lowerCategory.includes('sebze')) return <Utensils className="w-5 h-5 text-green-700" />;
    if (lowerCategory.includes('balık')) return <Drumstick className="w-5 h-5 text-blue-500" />;
    if (lowerCategory.includes('et')) return <Drumstick className="w-5 h-5 text-red-700" />;
    if (lowerCategory.includes('tahıl')) return <Coffee className="w-5 h-5 text-yellow-600" />;
    return <Utensils className="w-5 h-5 text-gray-500" />;
  };

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-800">Yemek Ekle</h1>
        <p className="text-gray-500">Geniş veritabanımızdan arayarak öğünlerinizi ekleyin.</p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Yiyecek ara..."
          className="pl-10 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="space-y-2 bg-white rounded-xl p-2 max-h-[calc(100vh-350px)] overflow-y-auto">
        <AnimatePresence>
          {loading ? (
            <div className="flex justify-center items-center p-4"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
          ) : (
            searchResults.map((food) => (
              <motion.div
                key={food.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                    setSelectedFood(food);
                    setQuantity(food.gram > 1 ? 1 : 100);
                    setUnit(food.gram > 1 ? 'adet' : 'gram');
                }}
              >
                <div className="flex items-center gap-3">
                    <FoodIcon category={food.category} />
                    <div>
                        <p className="font-semibold text-gray-800">{food.name_tr}</p>
                        <p className="text-sm text-gray-500">{food.calories} kcal / {food.gram || 100}g</p>
                    </div>
                </div>
                <Plus className="w-5 h-5 text-emerald-500" />
              </motion.div>
            ))
          )}
        </AnimatePresence>
        {!loading && searchResults.length === 0 && searchTerm.length > 1 && (
            <div className="text-center p-4 text-gray-500">Sonuç bulunamadı.</div>
        )}
      </div>

      <Dialog open={!!selectedFood} onOpenChange={() => setSelectedFood(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedFood?.name_tr}</DialogTitle>
            <DialogDescription>
              Miktarı ve öğün türünü seçerek ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div className="flex items-end gap-2">
                <div className="flex-grow">
                    <Label htmlFor="quantity">Miktar</Label>
                    <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))} className="text-lg font-bold mt-1"/>
                </div>
                <div className="w-1/3">
                    <Label htmlFor="unit">Birim</Label>
                    <Select onValueChange={setUnit} value={unit}>
                        <SelectTrigger id="unit" className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gram">Gram</SelectItem>
                          <SelectItem value="adet">Adet</SelectItem>
                          <SelectItem value="porsiyon">Porsiyon</SelectItem>
                          <SelectItem value="bardak">Bardak</SelectItem>
                          <SelectItem value="kasik">Kaşık</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <Select onValueChange={setMealType} defaultValue={mealType}>
                <SelectTrigger><SelectValue placeholder="Öğün Türü Seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kahvaltı">Kahvaltı</SelectItem>
                  <SelectItem value="Öğle Yemeği">Öğle Yemeği</SelectItem>
                  <SelectItem value="Akşam Yemeği">Akşam Yemeği</SelectItem>
                  <SelectItem value="Atıştırmalık">Atıştırmalık</SelectItem>
                </SelectContent>
              </Select>
            
            {calculatedMacros && (
                <div className="grid grid-cols-2 gap-4 text-center bg-gray-50 p-4 rounded-lg">
                    <div><p className="font-bold text-xl text-emerald-600">{calculatedMacros.calories}</p><p className="text-sm text-gray-500">Kalori</p></div>
                    <div><p className="font-bold text-xl text-blue-600">{calculatedMacros.protein}g</p><p className="text-sm text-gray-500">Protein</p></div>
                    <div><p className="font-bold text-xl text-orange-600">{calculatedMacros.carbs}g</p><p className="text-sm text-gray-500">Karbonhidrat</p></div>
                    <div><p className="font-bold text-xl text-red-600">{calculatedMacros.fat}g</p><p className="text-sm text-gray-500">Yağ</p></div>
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFood(null)}>İptal</Button>
            <Button onClick={handleAddMeal}>Öğüne Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MealTracker;