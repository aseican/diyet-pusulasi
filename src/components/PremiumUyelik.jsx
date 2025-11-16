import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; 

// Kullanıcının planına göre AI hakkını ve fiyatı gösteren plan listesi
const pricingTiers = [
  {
    tier: 'free',
    name: 'Ücretsiz',
    description: 'Temel takibin ve manuel girişin yeterli olduğu plan.',
    price: '₺0',
    frequency: '/ Sonsuza Kadar',
    features: [
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
      { name: 'AI Fotoğraf Analizi Hakkı', included: false, limit: '0/Gün' },
      { name: 'Su Takibi', included: true },
      { name: 'Kilo İlerleme Grafiği', included: true },
    ],
    buttonText: 'Mevcut Planınız',
    buttonVariant: 'secondary',
  },
  {
    tier: 'basic',
    name: 'Basic Premium',
    description: 'Yapay zeka analizini denemek isteyenler için ideal.',
    price: '₺59',
    frequency: '/ Aylık',
    features: [
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
      { name: 'AI Fotoğraf Analizi Hakkı', included: true, limit: '3/Gün' },
      { name: 'Öncelikli Destek', included: false },
      { name: 'Kilo İlerleme Grafiği', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
  {
    tier: 'pro',
    name: 'Pro Premium',
    description: 'Aktif kullanıcılar ve tüm önemli özelliklere erişim.',
    price: '₺99',
    frequency: '/ Aylık',
    features: [
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
      { name: 'AI Fotoğraf Analizi Hakkı', included: true, limit: '7/Gün' },
      { name: 'Öncelikli Destek', included: true },
      { name: 'Kilo İlerleme Grafiği', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
  {
    tier: 'kapsamli',
    name: 'Kapsamlı Sınırsız',
    description: 'En yoğun kullanıcılar için sıfır limit.',
    price: '₺149',
    frequency: '/ Aylık',
    features: [
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
      { name: 'AI Fotoğraf Analizi Hakkı', included: true, limit: 'Sınırsız' },
      { name: 'Öncelikli Destek', included: true },
      { name: 'Kilo İlerleme Grafiği', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
];

/**
 * Play Store'daki Ürün ID'leri (SKU'lar) ile yerel plan adlarını eşleştirir.
 * BU EŞLEŞTİRME GOOGLE PLAY CONSOLE'DAKI ID'LERİNİZLE UYUMLU OLMALIDIR.
 */
const productIdMap = {
    'basic': 'premium_basic_monthly', 
    'pro': 'premium_pro_monthly',
    'kapsamli': 'premium_unlimited_monthly',
};

// YENİ FONKSİYON: Native kodu tetiklemek için postMessage kullanır.
const handleSubscription = (tier) => {
    const productId = productIdMap[tier];

    if (!productId) {
        alert("Bilinmeyen plan seçildi.");
        return;
    }
    
    // 1. KONTROL: window.ReactNativeWebView var mı?
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        
        const message = {
            type: 'START_PURCHASE', // Native tarafta dinleyeceğimiz tip
            productId: productId, // Google Play SKU'su
        };
        
        // 2. MESAJ GÖNDERME: React Native'e mesajı ilet.
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
        
        alert("Ödeme ekranı açılıyor. Lütfen Play Store penceresini takip edin."); 
        
    } else {
        // WebView dışında çalışıyorsa hata göster (örneğin tarayıcıda)
        alert(`WebView köprüsü bulunamadı. Ödeme yalnızca mobil uygulamada başlatılabilir. (Test ID: ${productId})`); 
    }
};

// === ANA BİLEŞEN VE İSİMLİ DIŞA AKTARMA (NAMED EXPORT) ===
export const PremiumUyelik = () => {
  const { userData } = useAuth(); // Yüklenme kontrolünü App.jsx yaptığı için burada sadece veriyi çekiyoruz
  
  const currentPlan = userData?.plan_tier || 'free'; 

  return (
    <div className="p-4 space-y-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Premium Planınızı Seçin</h1>
      
      {/* UI Fix: Kartlar tek kolonda ve ortalanmış */}
      <div className="flex flex-col gap-4"> 
        {pricingTiers.map((tierData) => (
          <Card 
            key={tierData.tier} 
            className={`flex flex-col shadow-md hover:shadow-lg transition-shadow ${tierData.tier === currentPlan ? 'ring-4 ring-emerald-500 shadow-xl' : ''}`}
          >
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">{tierData.name}</CardTitle>
              <CardDescription>{tierData.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="flex-grow">
              <div className="text-3xl font-bold mb-4 text-center">
                {tierData.price}
                <span className="text-sm font-normal text-gray-500">{tierData.frequency}</span>
              </div>
              
              <ul className="space-y-2 text-sm">
                {tierData.features.map((feature) => (
                  <li key={feature.name} className="flex items-center space-x-2">
                    {feature.included ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-red-500" />}
                    <span>{feature.name}</span>
                    {feature.limit && <span className="text-emerald-600 font-medium">({feature.limit})</span>}
                  </li>
                ))}
              </ul>
            </CardContent>
            
            <CardFooter className="pt-4">
              {currentPlan === tierData.tier ? (
                <Button className="w-full bg-gray-400 cursor-default" disabled>Mevcut Planınız</Button>
              ) : (
                <Button 
                  className="w-full"
                  variant={tierData.buttonVariant}
                  onClick={() => handleSubscription(tierData.tier)}
                >
                  {tierData.buttonText}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};