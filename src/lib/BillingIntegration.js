import * as RNIap from 'react-native-iap';
import { supabase } from '@/lib/customSupabaseClient'; // App.jsx'ten gelen supabase client
import { getSupabaseSessionToken } from '@/contexts/SupabaseAuthContext'; // Oturum token'ını çeker

// Lütfen bu URL'yi kendi Supabase Edge Function URL'inizle değiştirin!
// Örn: https://<PROJE_ID>.supabase.co/functions/v1/analyze-food-image/verify-purchase
const SUPABASE_VERIFY_URL = `${supabase.functionsUrl}/v1/analyze-food-image/verify-purchase`;

// Bu, PremiumUyelik.jsx'ten gelen mesajı işleyen ana fonksiyondur.
export const handlePurchase = async (productId, webViewRef, updateUserData, toast) => {
    try {
        toast({ title: "Ödeme Başlatılıyor", description: "Google Play penceresi açılıyor...", duration: 2000 });

        // 1. Ürün detaylarını Play Store'dan al
        const products = await RNIap.getProducts({ skus: [productId] });
        const product = products[0];

        if (!product) {
            throw new Error(`Ürün ID'si bulunamadı: ${productId}`);
        }

        // 2. Satın alma akışını başlat
        const purchase = await RNIap.requestPurchase({ 
            sku: productId, 
            andDangerouslyFinishTransactionAutomatically: false // Satın almayı kendimiz onaylayacağız
        });

        // 3. Satın Alma Başarılı! Sunucu doğrulamasına git.
        await verifyPurchaseOnServer(purchase, webViewRef, updateUserData, toast);

    } catch (error) {
        console.error('❌ Satın Alma Akışı Hatası:', error);
        toast({ 
            variant: 'destructive',
            title: "Ödeme Başarısız", 
            description: error.message || "Ödeme işlemi iptal edildi veya bir sorun oluştu.", 
        });
        
        // Hata durumunda WebView'a geri bildirim gönder
        if (webViewRef?.current?.postMessage) {
            webViewRef.current.postMessage(JSON.stringify({ type: 'PURCHASE_RESULT', status: 'CANCELED' }));
        }
    }
};

// Satın Alma Token'ını Supabase Edge Function'a gönderir
const verifyPurchaseOnServer = async (purchase, webViewRef, updateUserData, toast) => {
    const androidPurchase = purchase.transactionReceipt ? purchase : purchase.android[0]; // iOS/Android ayrımı
    
    // Gerekli verileri çıkarın
    const payload = {
        purchaseToken: androidPurchase.purchaseToken,
        productId: androidPurchase.productId,
        // Uygulamanızın paket adı (Play Console'dan alın)
        packageName: "com.diyetpusulasi.diyetpusulasi", // BURAYI DEĞİŞTİRİN
    };

    try {
        const token = await getSupabaseSessionToken();
        if (!token) throw new Error("Kullanıcı oturumu bulunamadı.");

        // Edge Function'ı çağır
        const response = await fetch(SUPABASE_VERIFY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, 
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
            // 1. İşlemi Play Store'da Tamamla (Çok Kritik!)
            await RNIap.finishTransaction({ purchase: androidPurchase, isConsumable: false });
            
            // 2. React Native State'ini Güncelle (Supabase'ten çekilen veriyi yeniler)
            // Bu, App.jsx'teki fetchUserData fonksiyonunu tetikleyebilir.
            updateUserData({ plan_tier: data.plan_tier }); 

            // 3. WebView'a başarılı geri bildirim gönder
            if (webViewRef?.current?.postMessage) {
                webViewRef.current.postMessage(JSON.stringify({ type: 'PREMIUM_GRANTED', plan: data.plan_tier }));
            }
            
            toast({ title: 'Tebrikler!', description: 'Premium üyeliğiniz başarıyla etkinleştirildi! 🎉' });
        } else {
            throw new Error(data.error || 'Sunucu doğrulaması başarısız oldu.');
        }
    } catch (e) {
        console.error('❌ Sunucu Doğrulama Hatası:', e);
        // Doğrulama hatası varsa, işlemi Play Store'da TAMAMLAMAYIN.
        toast({ 
            variant: 'destructive',
            title: "Doğrulama Hatası", 
            description: "Satın alma doğrulanamadı. Destekle iletişime geçin.", 
        });
        
        // Hata durumunda WebView'a geri bildirim gönder
        if (webViewRef?.current?.postMessage) {
            webViewRef.current.postMessage(JSON.stringify({ type: 'PURCHASE_RESULT', status: 'SERVER_ERROR' }));
        }
    }
};