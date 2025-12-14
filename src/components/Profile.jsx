import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, Edit2, Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// =====================================================
// PLAN NORMALIZATION + BADGES
// =====================================================
const normalizePlan = (plan) => {
  if (!plan) return "free";
  const p = plan.toString().trim().toLowerCase();
  if (["kapsamli", "kapsamlı", "unlimited", "sub_unlimited_monthly"].includes(p))
    return "sub_unlimited_monthly";
  if (["pro", "sub_pro_monthly"].includes(p)) return "sub_pro_monthly";
  if (["premium", "basic", "sub_premium_monthly"].includes(p)) return "sub_premium_monthly";
  return "free";
};

const PLAN_BADGES = {
  sub_premium_monthly: { label: "Premium", color: "text-blue-100" },
  sub_pro_monthly: { label: "Pro", color: "text-purple-100" },
  sub_unlimited_monthly: { label: "Kapsamlı", color: "text-yellow-100" },
};

// =====================================================
// SENİN HESAP (Harris-Benedict + aktivite + hedef)
// =====================================================
function calculateTargetCaloriesHB({ gender, weight, height, age, activity_level, goal_type }) {
  const w = Number(weight) || 0;
  const h = Number(height) || 0;
  const a = Number(age) || 0;

  let bmr = 0;
  if (gender === "male") {
    bmr = 66.5 + 13.75 * w + 5 * h - 6.77 * a;
  } else {
    bmr = 655.1 + 9.56 * w + 1.85 * h - 4.68 * a;
  }

  const activityLevels = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const activity = activityLevels[activity_level] || 1.2;

  let total = bmr * activity;

  if (goal_type === "lose") total *= 0.85;
  if (goal_type === "gain") total *= 1.15;

  return Math.round(total);
}

function calcBMI(heightCm, weightKg) {
  const h = Number(heightCm) || 0;
  const w = Number(weightKg) || 0;
  if (!h || !w) return 0;
  return w / ((h / 100) ** 2);
}

function bmiLabel(bmi) {
  if (!bmi || bmi <= 0) return "";
  if (bmi < 18.5) return "Zayıf";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Fazla Kilolu";
  if (bmi < 35) return "Obez";
  return "İleri Obez";
}

const Profile = ({ userData, updateUserData }) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    weight: "",
    target_weight: "",
    height: "",
    age: "",
    target_calories: "",
    activity_level: "light",
    gender: "female",
    goal_type: "lose",
  });

  useEffect(() => {
    if (!userData) return;
    setFormData({
      username: userData.username || "",
      weight: userData.weight ?? "",
      target_weight: userData.target_weight ?? "",
      height: userData.height ?? "",
      age: userData.age ?? "",
      target_calories: userData.target_calories ?? "",
      activity_level: userData.activity_level || "light",
      gender: userData.gender || "female",
      goal_type: userData.goal_type || "lose",
    });
  }, [userData]);

  // ✅ Üst kart: editing modunda formData'dan, değilse userData'dan hesapla
  const liveHeight = isEditing ? formData.height : userData?.height;
  const liveWeight = isEditing ? formData.weight : userData?.weight;
  const liveTargetWeight = isEditing ? formData.target_weight : userData?.target_weight;

  const bmiValue = useMemo(() => {
    const v = calcBMI(liveHeight, liveWeight);
    return v ? Number(v.toFixed(1)) : 0;
  }, [liveHeight, liveWeight]);

  const bmiText = useMemo(() => bmiLabel(bmiValue), [bmiValue]);

  const planKey = normalizePlan(userData?.plan_tier);
  const badge = PLAN_BADGES[planKey];

  const liveSuggestedCalories = useMemo(() => {
    const w = Number(formData.weight) || 0;
    const h = Number(formData.height) || 0;
    const a = Number(formData.age) || 0;
    if (!w || !h || !a) return 0;
    return calculateTargetCaloriesHB({
      gender: formData.gender,
      weight: w,
      height: h,
      age: a,
      activity_level: formData.activity_level,
      goal_type: formData.goal_type,
    });
  }, [
    formData.gender,
    formData.weight,
    formData.height,
    formData.age,
    formData.activity_level,
    formData.goal_type,
  ]);

  const handleSave = () => {
    const numericData = {
      weight: parseFloat(formData.weight) || 0,
      height: parseInt(formData.height, 10) || 0,
      age: parseInt(formData.age, 10) || 0,
      target_weight: parseFloat(formData.target_weight) || 0,
    };

    const autoTargetCalories = calculateTargetCaloriesHB({
      gender: formData.gender,
      weight: numericData.weight,
      height: numericData.height,
      age: numericData.age,
      activity_level: formData.activity_level,
      goal_type: formData.goal_type,
    });

    const finalTargetCalories = formData.target_calories
      ? parseInt(formData.target_calories, 10)
      : autoTargetCalories;

    updateUserData({
      ...formData,
      ...numericData,
      target_calories: finalTargetCalories,
    });

    setIsEditing(false);
    toast({ title: "Profil güncellendi" });
  };

  if (!userData) {
    return <div className="flex items-center justify-center p-8">Yükleniyor...</div>;
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Profilim</h2>
        <Button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isEditing ? (
            <>
              <Save className="w-4 h-4 mr-2" /> Kaydet
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 mr-2" /> Düzenle
            </>
          )}
        </Button>
      </div>

      {/* ÜST KART (eski görünüm hissi) */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl"
      >
        {badge && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 bg-white/20">
            <Star className="w-4 h-4" />
            <span className={badge.color}>{badge.label}</span>
          </div>
        )}

        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold">{formData.username || userData.username || "Kullanıcı"}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs opacity-90">VKİ</p>
            <p className="text-3xl font-extrabold leading-tight">{bmiValue || "0"}</p>
            <p className="text-sm opacity-90 mt-1">{bmiText}</p>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs opacity-90">Hedef</p>
            <p className="text-3xl font-extrabold leading-tight">{Number(liveTargetWeight) || 0} kg</p>
            <p className="text-sm opacity-90 mt-1">Kilo Hedefi</p>
          </div>
        </div>
      </motion.div>

      {/* KİŞİSEL BİLGİLER (alttaki kısım) */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h4 className="text-xl font-bold text-gray-800">Kişisel Bilgiler</h4>

        <div className="space-y-2">
          <Label>Kullanıcı Adı</Label>
          <Input
            value={formData.username}
            disabled={!isEditing}
            onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Cinsiyet */}
          <div className="space-y-2">
            <Label>Cinsiyet</Label>
            <RadioGroup
              value={formData.gender}
              onValueChange={(v) => isEditing && setFormData((p) => ({ ...p, gender: v }))}
              className="flex gap-6 pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" disabled={!isEditing} />
                <Label htmlFor="female">Kadın</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" disabled={!isEditing} />
                <Label htmlFor="male">Erkek</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Yaş */}
          <div className="space-y-2">
            <Label>Yaş</Label>
            <Input
              type="number"
              value={formData.age}
              disabled={!isEditing}
              onChange={(e) => setFormData((p) => ({ ...p, age: e.target.value }))}
            />
          </div>

          {/* Boy */}
          <div className="space-y-2">
            <Label>Boy (cm)</Label>
            <Input
              type="number"
              value={formData.height}
              disabled={!isEditing}
              onChange={(e) => setFormData((p) => ({ ...p, height: e.target.value }))}
            />
          </div>

          {/* Mevcut kilo */}
          <div className="space-y-2">
            <Label>Mevcut Kilo (kg)</Label>
            <Input
              type="number"
              value={formData.weight}
              disabled={!isEditing}
              onChange={(e) => setFormData((p) => ({ ...p, weight: e.target.value }))}
            />
          </div>
        </div>

        {/* Hedefler */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Hedef Kilo (kg)</Label>
            <Input
              type="number"
              value={formData.target_weight}
              disabled={!isEditing}
              onChange={(e) => setFormData((p) => ({ ...p, target_weight: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Aktivite</Label>
            <Select
              value={formData.activity_level}
              onValueChange={(v) => isEditing && setFormData((p) => ({ ...p, activity_level: v }))}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Hareketsiz</SelectItem>
                <SelectItem value="light">Az aktif</SelectItem>
                <SelectItem value="moderate">Orta aktif</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amaç</Label>
            <Select
              value={formData.goal_type}
              onValueChange={(v) => isEditing && setFormData((p) => ({ ...p, goal_type: v }))}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Kilo ver</SelectItem>
                <SelectItem value="maintain">Koru</SelectItem>
                <SelectItem value="gain">Kilo al</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hedef Kalori</Label>
            <Input
              type="number"
              value={formData.target_calories}
              disabled={!isEditing}
              placeholder={liveSuggestedCalories ? `Öneri: ${liveSuggestedCalories}` : "Boş bırak: otomatik"}
              onChange={(e) => setFormData((p) => ({ ...p, target_calories: e.target.value }))}
            />
            {liveSuggestedCalories > 0 && (
              <div className="text-xs text-gray-500">
                Otomatik hesap (senin formülün): <b>{liveSuggestedCalories}</b> kcal
              </div>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="text-xs text-gray-500">
            Düzenlemek için sağ üstten <b>Düzenle</b>’ye bas.
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
