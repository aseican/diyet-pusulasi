import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowRight, ArrowLeft, HeartPulse, Scale, Mountain, Star, Wind, Snowflake, Flame } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    goal_type: 'lose',
    gender: 'female',
    age: '30',
    height: '170',
    weight: '70',
    target_weight: '65',
    activity_level: 'light',
  });

  // -----------------------------
  // 🔥 HARRIS–BENEDICT KALORİ HESABI
  // -----------------------------
  const calculateTargetCalories = () => {
    const gender = formData.gender;
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    const age = parseInt(formData.age);

    let bmr;

    // --- Harris-Benedict Formülü ---
    if (gender === "male") {
      bmr = 66.5 + (13.75 * weight) + (5 * height) - (6.77 * age);
    } else {
      bmr = 655.1 + (9.56 * weight) + (1.85 * height) - (4.68 * age);
    }

    // --- Aktivite katsayısı ---
    const activityLevels = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
    };

    const activity = activityLevels[formData.activity_level] || 1.2;
    let total = bmr * activity;

    // --- Hedef ---
    if (formData.goal_type === "lose") total *= 0.85;
    if (formData.goal_type === "gain") total *= 1.15;

    return Math.round(total);
  };

  // -----------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    if (step === 1 && !formData.username) {
      toast({ title: 'Lütfen kullanıcı adınızı girin.', variant: 'destructive' });
      return;
    }
    if (
      step === 2 &&
      (!formData.age || !formData.height || !formData.weight || !formData.target_weight)
    ) {
      toast({ title: 'Lütfen tüm alanları doldurun.', variant: 'destructive' });
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const handleSubmit = () => {
    const calories = calculateTargetCalories();

    const fullData = {
      ...formData,
      target_calories: calories,
    };

    onComplete(fullData);
  };

  const slideVariants = {
    hidden: { opacity: 0, x: 100 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  };

  // ------------------  ADIM 1 ------------------
  const Step1 = (
    <motion.div variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Hesabınızı Kuralım!</h1>
      <p className="text-gray-600">Sağlıklı yaşam yolculuğunuza başlamak için birkaç adıma ihtiyacımız var.</p>
      <div className="space-y-2">
        <Label htmlFor="username">Kullanıcı Adınız</Label>
        <Input id="username" name="username" placeholder="Örn: ayse123" value={formData.username} onChange={handleChange} />
      </div>
      <div className="space-y-3">
        <Label>Temel hedefiniz nedir?</Label>
        <RadioGroup name="goal_type" value={formData.goal_type} onValueChange={(v) => handleRadioChange('goal_type', v)} className="flex gap-4">
          <Label htmlFor="lose" className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
            <RadioGroupItem value="lose" id="lose" className="sr-only" />
            <Scale className="w-8 h-8 mb-2" /> Kilo Vermek
          </Label>
          <Label htmlFor="maintain" className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
            <RadioGroupItem value="maintain" id="maintain" className="sr-only" />
            <HeartPulse className="w-8 h-8 mb-2" /> Kilo Korumak
          </Label>
          <Label htmlFor="gain" className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
            <RadioGroupItem value="gain" id="gain" className="sr-only" />
            <Mountain className="w-8 h-8 mb-2" /> Kilo Almak
          </Label>
        </RadioGroup>
      </div>
    </motion.div>
  );

  // ------------------  ADIM 2 ------------------
  const Step2 = (
    <motion.div variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Sizi Tanıyalım</h2>
      <div className="space-y-3">
        <Label>Cinsiyetiniz</Label>
        <RadioGroup name="gender" value={formData.gender} onValueChange={(v) => handleRadioChange('gender', v)} className="grid grid-cols-2 gap-4">
          <Label htmlFor="female" className="flex items-center justify-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
            <RadioGroupItem value="female" id="female" className="sr-only" /> Kadın
          </Label>
          <Label htmlFor="male" className="flex items-center justify-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
            <RadioGroupItem value="male" id="male" className="sr-only" /> Erkek
          </Label>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="age">Yaş</Label>
          <Input id="age" name="age" type="number" value={formData.age} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="height">Boy (cm)</Label>
          <Input id="height" name="height" type="number" value={formData.height} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="weight">Kilo (kg)</Label>
          <Input id="weight" name="weight" type="number" step="0.1" value={formData.weight} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="target_weight">Hedef Kilo (kg)</Label>
          <Input id="target_weight" name="target_weight" type="number" step="0.1" value={formData.target_weight} onChange={handleChange} />
        </div>
      </div>
    </motion.div>
  );

  // ------------------  ADIM 3 ------------------
  const Step3 = (
    <motion.div variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Aktivite Seviyeniz</h2>
      <RadioGroup name="activity_level" value={formData.activity_level} onValueChange={(v) => handleRadioChange('activity_level', v)} className="space-y-3">
        <Label htmlFor="sedentary" className="flex items-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
          <RadioGroupItem value="sedentary" id="sedentary" className="sr-only" />
          <Snowflake className="w-6 h-6 mr-3" /> Hareketsiz (Ofis işi)
        </Label>

        <Label htmlFor="light" className="flex items-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
          <RadioGroupItem value="light" id="light" className="sr-only" />
          <Wind className="w-6 h-6 mr-3" /> Hafif Aktif (Haftada 1-3 gün)
        </Label>

        <Label htmlFor="moderate" className="flex items-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
          <RadioGroupItem value="moderate" id="moderate" className="sr-only" />
          <Flame className="w-6 h-6 mr-3" /> Orta Aktif (3-5 gün)
        </Label>

        <Label htmlFor="active" className="flex items-center p-4 border rounded-lg cursor-pointer [&:has([data-state=checked])]:bg-emerald-50">
          <RadioGroupItem value="active" id="active" className="sr-only" />
          <Star className="w-6 h-6 mr-3" /> Çok Aktif (6-7 gün)
        </Label>
      </RadioGroup>
    </motion.div>
  );

  // ------------------ RENDER ------------------
  return (
    <div className="flex flex-col h-full p-8 bg-white">
      <div className="flex-grow">
        <AnimatePresence mode="wait">
          {step === 1 && <div key="step1">{Step1}</div>}
          {step === 2 && <div key="step2">{Step2}</div>}
          {step === 3 && <div key="step3">{Step3}</div>}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-8">
        {step > 1 ? (
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Geri
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <Button onClick={nextStep} className="bg-gradient-to-r from-emerald-500 to-teal-600">
            İleri <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} className="bg-gradient-to-r from-green-500 to-emerald-600">
            Başla! 🎉
          </Button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;