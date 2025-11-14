import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, Target, Calendar, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Progress = ({ userData }) => {
  if (!userData) {
    return <div className="p-6">Yükleniyor...</div>;
  }

  // 🧩 Kullanıcı verileri
  const { weight, target_weight, start_weight, weight_history, daily_deficit, goal_type } = userData;

  // 🧮 Kilo geçmişini sıralayıp formatla
  const formattedWeightHistory = (weight_history || [])
    .map(entry => ({
      date: new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      weight: entry.weight
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // 🎯 Başlangıç / Mevcut / Hedef kilolar
  const initialWeight = Number(start_weight) || (formattedWeightHistory.length > 0 ? formattedWeightHistory[0].weight : 0);
  const currentWeight = Number(weight) || initialWeight;
  const targetWeight = Number(target_weight) || initialWeight;

  // 💡 Kalori açığına göre tahmini kilo kaybı (isteğe bağlı)
  // 7000 kcal = 1 kg
  const predictedLoss = daily_deficit ? daily_deficit / 7000 : 0;

  // 📉 Gerçek veya tahmini kilo değişimi
  const weightChange = Math.max(0, (initialWeight - currentWeight + predictedLoss).toFixed(1));

  // 🎯 Hedefe kalan
  const remaining = Math.max(0, (currentWeight - targetWeight).toFixed(1));

  // 📊 Hedef ilerlemesi
  const totalToLose = initialWeight - targetWeight;
  let progress = 0;

  if (goal_type === 'lose' && totalToLose > 0) {
    progress = (weightChange / totalToLose) * 100;
  } else if (goal_type === 'gain' && totalToLose < 0) {
    const totalToGain = targetWeight - initialWeight;
    const gained = currentWeight - initialWeight;
    progress = (gained / totalToGain) * 100;
  }

  progress = Math.max(0, Math.min(100, progress));

  // 🧾 Ekran
  return (
    <div className="px-6 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">İlerleme Takibi</h2>

      {/* Kartlar */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg"
        >
          <TrendingDown className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-3xl font-bold">{weightChange} kg</p>
          <p className="text-sm opacity-90 mt-1">{goal_type === 'gain' ? 'Alınan' : 'Verilen'}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg"
        >
          <Target className="w-8 h-8 mb-2 opacity-90" />
          <p className="text-3xl font-bold">{remaining > 0 ? remaining : '🎉'} kg</p>
          <p className="text-sm opacity-90 mt-1">Hedefe Kalan</p>
        </motion.div>
      </div>

      {/* Hedef ilerlemesi */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            Hedef İlerlemesi
          </h3>
          <span className="text-2xl font-bold text-emerald-600">{progress.toFixed(0)}%</span>
        </div>
        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>Başlangıç: {initialWeight.toFixed(1)} kg</span>
          <span>Hedef: {targetWeight.toFixed(1)} kg</span>
        </div>
      </motion.div>

      {/* Kilo grafiği */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
      >
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Kilo Değişim Grafiği
        </h3>
        {formattedWeightHistory.length > 1 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={formattedWeightHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} domain={['dataMin - 2', 'dataMax + 2']} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                formatter={(value) => [`${value} kg`, 'Kilo']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <p>Grafiği görmek için daha fazla kilo verisi eklemelisiniz.</p>
            <p className="text-sm">Profilinizi düzenli olarak güncelleyin.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Progress;