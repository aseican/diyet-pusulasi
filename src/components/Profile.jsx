
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Edit2, Save, Star, Wind, Snowflake, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { calculateBMR, calculateTDEE } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const Profile = ({ userData, updateUserData }) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    weight: '',
    target_weight: '',
    height: '',
    age: '',
    target_calories: '',
    activity_level: 'light',
    gender: 'female',
    goal_type: 'lose'
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        username: userData.username || '',
        weight: userData.weight || '',
        target_weight: userData.target_weight || '',
        height: userData.height || '',
        age: userData.age || '',
        target_calories: userData.target_calories || '',
        activity_level: userData.activity_level || 'light',
        gender: userData.gender || 'female',
        goal_type: userData.goal_type || 'lose'
      });
    }
  }, [userData]);


  const handleSave = () => {
    const numericData = {
        weight: parseFloat(formData.weight) || 0,
        height: parseInt(formData.height) || 0,
        age: parseInt(formData.age) || 0,
    };

    const bmr = calculateBMR({ ...numericData, gender: formData.gender });
    const tdee = calculateTDEE(bmr, formData.activity_level);
    
    let calculated_target_calories;
    if (formData.goal_type === 'lose') {
      calculated_target_calories = tdee - 500;
    } else if (formData.goal_type === 'gain') {
      calculated_target_calories = tdee + 500;
    } else {
      calculated_target_calories = tdee;
    }

    const updatedProfile = {
      ...formData,
      ...numericData,
      target_weight: parseFloat(formData.target_weight) || 0,
      target_calories: formData.target_calories ? parseInt(formData.target_calories) : Math.round(calculated_target_calories),
    };
    
    updateUserData(updatedProfile);
    setIsEditing(false);
  };

  const bmi = userData?.height && userData?.weight 
    ? (userData.weight / ((userData.height / 100) ** 2)).toFixed(1)
    : 0;

  const getBMICategory = (bmiValue) => {
    if (bmiValue < 18.5) return { text: 'Zayıf', color: 'text-blue-600' };
    if (bmiValue < 25) return { text: 'Normal', color: 'text-emerald-600' };
    if (bmiValue < 30) return { text: 'Fazla Kilolu', color: 'text-orange-600' };
    return { text: 'Obez', color: 'text-red-600' };
  };

  const bmiCategory = getBMICategory(bmi);

  if (!userData) {
    return <div className="flex items-center justify-center p-8">Yükleniyor...</div>;
  }
  
  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Profilim</h2>
        <Button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          {isEditing ? (
            <>
              <Save className="w-4 h-4 mr-2" />
              Kaydet
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 mr-2" />
              Düzenle
            </>
          )}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">{userData?.username || 'Kullanıcı'}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-100 text-xs mb-1">VKİ</p>
            <p className="text-2xl font-bold">{bmi}</p>
            <p className={`text-xs mt-1 font-bold ${bmiCategory.color.replace('text-', 'text-emerald-')}`}>{bmiCategory.text}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-emerald-100 text-xs mb-1">Hedef</p>
            <p className="text-2xl font-bold">{userData?.target_weight} kg</p>
            <p className="text-xs mt-1">Kilo Hedefi</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
      >
        <h3 className="font-semibold text-gray-800 mb-4">Kişisel Bilgiler</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!isEditing}
              className="mt-1"
            />
          </div>
           <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cinsiyet</Label>
              <RadioGroup name="gender" value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})} className="flex gap-4 mt-2" disabled={!isEditing}>
                  <Label htmlFor="female_prof" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="female" id="female_prof" /> Kadın</Label>
                  <Label htmlFor="male_prof" className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="male" id="male_prof" /> Erkek</Label>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="age">Yaş</Label>
              <Input id="age" type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} disabled={!isEditing} className="mt-1"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="height">Boy (cm)</Label>
              <Input id="height" type="number" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} disabled={!isEditing} className="mt-1"/>
            </div>
            <div>
               <Label htmlFor="weight">Mevcut Kilo (kg)</Label>
              <Input id="weight" type="number" step="0.1" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} disabled={!isEditing} className="mt-1"/>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
      >
        <h3 className="font-semibold text-gray-800 mb-4">Hedefler ve Yaşam Tarzı</h3>
         <div className="space-y-4">
            <div>
              <Label htmlFor="target_weight">Hedef Kilo (kg)</Label>
              <Input id="target_weight" type="number" step="0.1" value={formData.target_weight} onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })} disabled={!isEditing} className="mt-1"/>
            </div>
            <div>
                <Label>Aktivite Seviyesi</Label>
                <RadioGroup name="activity_level" value={formData.activity_level} onValueChange={(v) => setFormData({...formData, activity_level: v})} className="space-y-2 mt-2" disabled={!isEditing}>
                    <Label htmlFor="p-sedentary" className="flex items-center p-2 border rounded-lg cursor-pointer text-sm"><RadioGroupItem value="sedentary" id="p-sedentary" className="mr-2"/> <Snowflake className="w-5 h-5 mr-2"/> Hareketsiz</Label>
                    <Label htmlFor="p-light" className="flex items-center p-2 border rounded-lg cursor-pointer text-sm"><RadioGroupItem value="light" id="p-light" className="mr-2"/> <Wind className="w-5 h-5 mr-2"/> Hafif Aktif</Label>
                    <Label htmlFor="p-moderate" className="flex items-center p-2 border rounded-lg cursor-pointer text-sm"><RadioGroupItem value="moderate" id="p-moderate" className="mr-2"/> <Flame className="w-5 h-5 mr-2"/> Orta Aktif</Label>
                    <Label htmlFor="p-active" className="flex items-center p-2 border rounded-lg cursor-pointer text-sm"><RadioGroupItem value="active" id="p-active" className="mr-2"/> <Star className="w-5 h-5 mr-2"/> Çok Aktif</Label>
                </RadioGroup>
                <p className="text-xs text-gray-500 mt-2">Kalori hedefiniz aktivite seviyenize göre otomatik hesaplanır. Manuel olarak değiştirmek için aşağıdaki alanı kullanın.</p>
            </div>
            <div>
                <Label htmlFor="target_calories">Günlük Kalori Hedefi (kcal)</Label>
                <Input id="target_calories" type="number" value={formData.target_calories} onChange={(e) => setFormData({ ...formData, target_calories: e.target.value })} disabled={!isEditing} className="mt-1"/>
            </div>
         </div>
      </motion.div>
    </div>
  );
};

export default Profile;
