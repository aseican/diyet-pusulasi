// ... (Tüm import'lar aynı kalır) ...
// ... (pricingTiers dizisi aynı kalır) ...

// ... (handleSubscription fonksiyonu aynı kalır) ...

export const PremiumUyelik = () => {
    const { user, userData, authLoading } = useAuth();
    
    if (authLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

    const currentPlan = userData?.plan_tier || 'free'; 

    return (
        <div className="p-4 space-y-8 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Premium Planınızı Seçin</h1>
            
            {/* UI Fix: Taşmayı önlemek için tek kolonlu grid, sadece küçük ekranlarda kaydırma */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto"> 
                {pricingTiers.map((tierData) => (
                    <Card 
                        key={tierData.tier} 
                        // Karta minimum genişlik veriyoruz ki içeriği sığsın
                        className={`flex flex-col min-w-[280px] ${tierData.tier === currentPlan ? 'ring-4 ring-emerald-500 shadow-xl' : ''}`}
                    >
                        {/* ... (geri kalan Card içeriği aynı kalır) ... */}
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