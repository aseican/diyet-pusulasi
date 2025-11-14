import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

// Ödeme sistemi entegrasyonundan sonra buraya kullanıcının plan verileri gelecek
// Şimdilik default planlar
const plans = [
    {
        title: 'Ücretsiz',
        price: '₺0 / Süresiz',
        description: 'Uygulamanın temel özelliklerini kullanın.',
        features: [
            { name: 'Kalori Takibi', available: true },
            { name: 'Su Takibi', available: true },
            { name: 'Sınırlı AI Analizi (Günde 1)', available: true },
            { name: 'Gelişmiş Raporlama', available: false },
        ],
        buttonText: 'Mevcut Planınız',
        isCurrent: true,
        className: 'border-emerald-500 bg-emerald-50/50',
    },
    {
        title: 'Basic Premium',
        price: '₺59 / Aylık',
        description: 'AI özellikleriyle hedeflerinize daha hızlı ulaşın.',
        features: [
            { name: 'Kalori Takibi', available: true },
            { name: 'Su Takibi', available: true },
            { name: 'Sınırsız AI Analizi', available: true },
            { name: 'Gelişmiş Raporlama', available: false },
        ],
        buttonText: 'Şimdi Abone Ol',
        isCurrent: false,
        className: 'border-blue-500',
    },
    {
        title: 'Pro Premium',
        price: '₺99 / Aylık',
        description: 'Tüm kısıtlamaları kaldırın, tam potansiyelinizi kullanın.',
        features: [
            { name: 'Kalori Takibi', available: true },
            { name: 'Su Takibi', available: true },
            { name: 'Sınırsız AI Analizi', available: true },
            { name: 'Gelişmiş Raporlama', available: true },
        ],
        buttonText: 'En Popüler Seçim',
        isCurrent: false,
        className: 'border-indigo-500 shadow-xl',
    },
];

const FeatureItem = ({ name, available }) => (
    <div className={`flex items-center text-sm ${available ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
        {available ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <X className="w-4 h-4 mr-2 text-red-400" />}
        {name}
    </div>
);

export const PremiumUyelik = () => {
    return (
        <div className="p-4 space-y-8 max-w-lg mx-auto">
            <h1 className="text-3xl font-bold text-center">Premium Üyelik Planları</h1>
            <p className="text-center text-muted-foreground">Hedeflerinize ulaşmanız için tasarlanmış, size özel çözümler.</p>

            {/* UI Fix: Grid ile taşma önleniyor */}
            <div className="grid grid-cols-1 gap-4">
                {plans.map((plan) => (
                    <Card key={plan.title} className={`shadow-md hover:shadow-lg transition-shadow ${plan.className}`}>
                        <CardHeader className="text-center pb-3">
                            <CardTitle className="text-2xl">{plan.title}</CardTitle>
                            <CardDescription className="text-lg font-semibold text-foreground">
                                {plan.price}
                            </CardDescription>
                            <CardDescription className="pt-2">{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {plan.features.map((feature, index) => (
                                <FeatureItem key={index} {...feature} />
                            ))}
                        </CardContent>
                        <CardFooter>
                            <Button 
                                className="w-full"
                                disabled={plan.isCurrent}
                                variant={plan.isCurrent ? "outline" : "default"}
                            >
                                {plan.buttonText}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4">
                Tüm Premium planlar 7 günlük ücretsiz deneme süresi içerir. İstediğiniz zaman iptal edebilirsiniz.
            </div>
        </div>
    );
};