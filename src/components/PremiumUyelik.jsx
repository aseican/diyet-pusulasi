import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// ⭐ PLAN OPTIONS (Senin istediğin gibi güncellendi)
const pricingTiers = [
  {
    tier: 'pro',
    name: 'Pro Plan',
    description: 'Günde 10 yapay zeka analizi hakkı.',
    price: '₺59',
    frequency: '/ Aylık',
    features: [
      { name: 'AI Fotoğraf Analizi', included: true, limit: '10 / Gün' },
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
      { name: 'Grafikler & Takip', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
  {
    tier: 'premium',
    name: 'Premium Plan',
    description: 'Günde 30 yapay zeka analizi hakkı.',
    price: '₺99',
    frequency: '/ Aylık',
    features: [
      { name: 'AI Fotoğraf Analizi', included: true, limit: '30 / Gün' },
      { name: 'Öncelikli Destek', included: true },
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
  {
    tier: 'kapsamli',
    name: 'Kapsamlı Sınırsız',
    description: 'Sınırsız yapay zeka analizi.',
    price: '₺149',
    frequency: '/ Aylık',
    features: [
      { name: 'AI Fotoğraf Analizi', included: true, limit: 'Sınırsız' },
      { name: 'Öncelikli Destek', included: true },
      { name: 'Sınırsız Manuel Öğün Takibi', included: true },
    ],
    buttonText: 'Abone Ol',
    buttonVariant: 'default',
  },
];

// ⭐ GOOGLE PLAY ÜRÜN ID EŞLEMESİ
const productIdMap = {
  pro: 'sub_pro_monthly',
  premium: 'sub_premium_monthly',
  kapsamli: 'sub_unlimited_monthly',
};

// ⭐ SATIN ALMA KOMUTU (WebView → Native)
const handleSubscription = (tier) => {
  const productId = productIdMap[tier];

  if (!productId) {
    alert("Ürün ID eşleşmesi bulunamadı.");
    return;
  }

  const payload = {
    type: 'START_PURCHASE',
    productId,
  };

  console.log("Satın alma isteği gönderildi:", payload);

  // React Native WebView
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    alert("Satın alma işlemi başlatılıyor (React Native)...");
    return;
  }

  // Android Native WebView
  if (window.AndroidBilling && window.AndroidBilling.startPurchase) {
    window.AndroidBilling.startPurchase(productId);
    alert("Satın alma işlemi başlatılıyor (Android Native)...");
    return;
  }

  alert("Ödeme sadece mobil uygulamada yapılabilir.");
};

// ⭐ COMPONENT
export const PremiumUyelik = () => {
  const { userData } = useAuth();

  const currentPlan = userData?.plan_tier || 'free';

  return (
    <div className="p-4 space-y-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Premium Planınızı Seçin</h1>

      <div className="flex flex-col gap-4">
        {pricingTiers.map((tierData) => (
          <Card
            key={tierData.tier}
            className={`flex flex-col shadow-md hover:shadow-lg transition-shadow ${
              tierData.tier === currentPlan ? 'ring-4 ring-emerald-500' : ''
            }`}
          >
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">{tierData.name}</CardTitle>
              <CardDescription>{tierData.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-grow">
              <div className="text-3xl font-bold mb-4 text-center">
                {tierData.price}
                <span className="text-sm text-gray-500">{tierData.frequency}</span>
              </div>

              <ul className="space-y-2 text-sm">
                {tierData.features.map((feature) => (
                  <li key={feature.name} className="flex items-center space-x-2">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span>{feature.name}</span>
                    {feature.limit && (
                      <span className="text-emerald-600 font-medium">({feature.limit})</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {currentPlan === tierData.tier ? (
                <Button className="w-full bg-gray-400" disabled>
                  Mevcut Planınız
                </Button>
              ) : (
                <Button
                  className="w-full"
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
