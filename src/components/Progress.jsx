import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart } from 'lucide-react';
import React from 'react';

// Kilo takibi verisi için varsayılan bir veri yapısı
// İleride buraya gerçek kilo kayıtlarınızın verisi gelecektir
const mockWeightData = [
  { name: 'Başlangıç', weight: 0 },
  { name: 'Hafta 1', weight: 0 },
  { name: 'Şimdi', weight: 0 },
];

// --- Hata Çözümü: Veri Dönüştürme ---
// Bu kısım ileride gerçek bir Chart kütüphanesi ile değiştirilmelidir.
const ProgressChart = ({ startWeight, currentWeight }) => {
    // Sayısal olmayan veya 0 olan veriyi varsayılan değere çek
    const startW = Number(startWeight) || 0;
    const currentW = Number(currentWeight) || 0;
    
    // Geçici olarak mock data'yı başlangıç ve mevcut kiloyla güncelleyelim
    const data = [
      { name: 'Başlangıç', weight: startW, color: 'hsl(120, 60%, 50%)' }, // Yeşil tonu
      { name: 'Şimdi', weight: currentW, color: 'hsl(210, 60%, 50%)' }, // Mavi tonu
    ];

    const maxWeight = Math.max(startW, currentW, 100); // Grafik yüksekliği için bir üst sınır
    const minWeight = Math.min(startW, currentW, 0);
    const range = maxWeight - minWeight;

    // Basit bir bar grafik gösterimi
    return (
        <div className="flex flex-col items-center p-4 space-y-4">
            <div className="w-full h-40 flex items-end justify-around">
                {data.map((item) => (
                    <div key={item.name} className="flex flex-col items-center h-full justify-end">
                        <div 
                            className="w-10 rounded-t-lg transition-all duration-500"
                            style={{
                                height: `${range > 0 ? ((item.weight - minWeight) / range) * 80 + 20 : 50}%`, // Oransal yükseklik
                                backgroundColor: item.color,
                            }}
                        ></div>
                        <span className="text-xs mt-1 font-medium">{item.weight.toFixed(1)} kg</span>
                    </div>
                ))}
            </div>
            <div className="flex justify-around w-full text-sm text-muted-foreground">
                {data.map(item => <span key={item.name}>{item.name}</span>)}
            </div>
        </div>
    );
};
// ------------------------------------------

export const Progress = ({ userData }) => {
  
  // HATA ÇÖZÜMÜ: Veriyi Number'a çevir
  const startWeight = Number(userData?.start_weight || 0); 
  const currentWeight = Number(userData?.weight || 0); 
  
  const weightChange = currentWeight - startWeight;
  const targetWeight = Number(userData?.target_weight || 0); 
  
  const daysPassed = Math.ceil((new Date() - new Date(userData?.created_at)) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Kilo İlerlemesi</CardTitle>
          <BarChart className="h-5 w-5 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <ProgressChart 
            startWeight={startWeight} 
            currentWeight={currentWeight} 
          />
          
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-medium">Toplam Değişim:</p>
            <p className={`text-2xl font-bold ${weightChange > 0 ? 'text-red-500' : weightChange < 0 ? 'text-emerald-500' : 'text-gray-600'}`}>
              {weightChange.toFixed(1)} kg
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hedef Metrikleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Başlangıç Kilo:</span>
            <span className="font-medium">{startWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mevcut Kilo:</span>
            <span className="font-medium">{currentWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hedef Kilo:</span>
            <span className="font-medium">{targetWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="text-muted-foreground">Kaydedilen Gün:</span>
            <span className="font-medium">{daysPassed} gün</span>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
};