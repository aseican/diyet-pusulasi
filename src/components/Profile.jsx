import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Edit2, Save, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { calculateBMR, calculateTDEE } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// =====================================================
// PLAN NORMALIZATION + BADGES
// =====================================================
const normalizePlan = (plan) => {
  if (!plan) return 'free';
  if (['kapsamli', 'unlimited', 'sub_unlimited_monthly'].includes(plan))
    return 'sub_unlimited_monthly';
  if (['pro', 'sub_pro_monthly'].includes(plan))
    return 'sub_pro_monthly';
  if (['premium', 'basic', 'sub_premium_monthly'].includes(plan))
    return 'sub_premium_monthly';
  return 'free';
};

const PLAN_BADGES = {
  sub_premium_monthly: { label: 'Premium', color: 'text-blue-100' },
  sub_pro_monthly: { label: 'Pro', color: 'text-purple-100' },
  sub_unlimited_monthly: { label: 'Kapsamlı', color: 'text-yellow-100' },
};

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
    goal_type: 'lose',
  });

  useEffect(() => {
    if (!userData) return;
    setFormData({
      username: userData.username || '',
      weight: userData.weight || '',
      target_weight: userData.target_weight || '',
      height: userData.height || '',
      age: userData.age || '',
      target_calories: userData.target_calories || '',
      activity_level: userData.activity_level || 'light',
      gender: userData.gender || 'female',
      goal_type: userData.goal_type || 'lose',
    });
  }, [userData]);

  const handleSave = () => {
    const numericData = {
      weight: parseFloat(formData.weight) || 0,
      height: parseInt(formData.height) || 0,
      age: parseInt(formData.age) || 0,
    };

    const bmr = calculateBMR({ ...numericData, gender: formData.gender });
    const tdee = calculateTDEE(bmr, formData.activity_level);

    const calculated_target_calories =
      formData.goal_type === 'lose'
        ? tdee - 500
        : formData.goal_type === 'gain'
        ? tdee + 500
        : tdee;

    updateUserData({
      ...formData,
      ...numericData,
      target_weight: parseFloat(formData.target_weight) || 0,
      target_calories: formData.target_calories
        ? parseInt(formData.target_calories)
        : Math.round(calculated_target_calories),
    });

    setIsEditing(false);
  };

  if (!userData) {
    return <div className="flex items-center justify-center p-8">Yükleniyor...</div>;
  }

  const planKey = normalizePlan(userData.plan_tier);
  const badge = PLAN_BADGES[planKey];

  const bmi =
    userData?.height && userData?.weight
      ? (userData.weight / ((userData.height / 100) ** 2)).toFixed(1)
      : 0;

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Profilim</h2>
        <Button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="bg-gradient-to-r from-emerald-500 to-teal-600"
        >
          {isEditing ? <><Save className="w-4 h-4 mr-2" /> Kaydet</> : <><Edit2 className="w-4 h-4 mr-2" /> Düzenle</>}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl"
      >
        {badge && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 bg-white/20">
            <Star className="w-4 h-4" />
            <span className={badge.color}>{badge.label}</span>
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold">{userData.username || 'Kullanıcı'}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs">VKİ</p>
            <p className="text-2xl font-bold">{bmi}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs">Hedef</p>
            <p className="text-2xl font-bold">{userData.target_weight} kg</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
