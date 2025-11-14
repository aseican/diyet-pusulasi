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

// Satın alma işlemini başlatacak fonksiyon (Paddle/Stripe Webhook'a bağlanacak)
const handleSubscription = async (tier) => {
  // ⚠️ BURASI KRİTİK ALAN ⚠️
  // Paddle onaylandıktan sonra buraya ödeme fonksiyonu gelecek.
  alert(`${tier} planı için ödeme başlatılıyor...`); 
};

// === ANA BİLEŞEN VE İSİMLİ DIŞA AKTARMA (NAMED EXPORT) ===
export const PremiumUyelik = () => { // Export const olarak tanımladık
  const { user, userData, authLoading } = useAuth();
  
  if (authLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const currentPlan = userData?.plan_tier || 'free'; 

  return (
    <div className="p-4 mobile-container">
      <h1 className="text-2xl font-bold mb-6 text-center">Premium Planınızı Seçin</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {pricingTiers.map((tierData) => (
          <Card 
            key={tierData.tier} 
            className={`flex flex-col ${tierData.tier === currentPlan ? 'ring-4 ring-emerald-500 shadow-xl' : ''}`}
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