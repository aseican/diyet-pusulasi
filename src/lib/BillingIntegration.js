import { supabase } from '@/lib/customSupabaseClient';

// ===============================
// 🔒 IAP MODÜLÜ GÜVENLİ ŞEKİLDE YÜKLE (WEB'DE ÇÖKMEZ)
// ===============================
let RNIap = null;
try {
  RNIap = require('react-native-iap');
} catch (e) {
  console.warn("react-native-iap yalnızca mobil uygulamada çalışır.");
}


// ===============================
// 🔗 EDGE FUNCTION URL
// ===============================
const SUPABASE_VERIFY_URL = `${supabase.functionsUrl}/v1/analyze-food-image/verify-purchase`;


// ===============================
// 🎯 SATIN ALMA AKIŞI
// ===============================
export const handlePurchase = async (productId, webViewRef, updateUserData, toast, token) => {

  // 👉 Eğer web'de çalışıyorsa IAP yoktur.
  if (!RNIap) {
    toast({
      variant: "destructive",
      title: "Sadece Mobilde Aktif",
      description: "Premium satın alma işlemi sadece mobil uygulamada yapılabilir.",
    });

    if (webViewRef?.current?.postMessage) {
      webViewRef.current.postMessage(
        JSON.stringify({ type: "PURCHASE_RESULT", status: "UNAVAILABLE_WEB" })
      );
    }
    return;
  }

  try {
    toast({ title: "Ödeme Başlatılıyor", description: "Google Play açılıyor..." });

    // 1️⃣ Ürün detaylarını çek
    const products = await RNIap.getProducts({ skus: [productId] });
    const product = products[0];

    if (!product) throw new Error(`Play Console ürün bulunamadı: ${productId}`);

    // 2️⃣ Satın alma akışını başlat
    const purchase = await RNIap.requestPurchase({
      sku: productId,
      andDangerouslyFinishTransactionAutomatically: false,
    });

    // 3️⃣ Sunucu doğrulamasına gönder
    await verifyPurchaseOnServer(purchase, webViewRef, updateUserData, toast, token);

  } catch (error) {
    console.error("❌ Satın Alma Hatası:", error);

    toast({
      variant: "destructive",
      title: "Ödeme Hatası",
      description: error.message || "Ödeme iptal edildi veya hata oluştu.",
    });

    if (webViewRef?.current?.postMessage) {
      webViewRef.current.postMessage(
        JSON.stringify({ type: "PURCHASE_RESULT", status: "CANCELED" })
      );
    }
  }
};



// ===============================
// 🛠️ SUNUCU DOĞRULAMA
// ===============================
const verifyPurchaseOnServer = async (purchase, webViewRef, updateUserData, toast, token) => {
  
  // Android format düzeltmesi
  const androidPurchase = purchase.transactionReceipt
    ? purchase
    : purchase.android?.[0];

  if (!androidPurchase) {
    throw new Error("Satın alma yapısı okunamadı. purchase.android null döndü.");
  }

  const payload = {
    purchaseToken: androidPurchase.purchaseToken,
    productId: androidPurchase.productId,
    packageName: "com.example.yourapppackage", // 👉 BUNU MUTLAKA KENDİ PAKET ADINLA DEĞİŞTİR
  };

  try {
    if (!token) throw new Error("Kullanıcı oturumu bulunamadı.");

    // 1️⃣ Edge Function doğrulaması
    const response = await fetch(SUPABASE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.error || "Doğrulama başarısız.");
    }

    // 2️⃣ Play Store işlemini tamamla
    await RNIap.finishTransaction({
      purchase: androidPurchase,
      isConsumable: false,
    });

    // 3️⃣ Kullanıcı state'ini güncelle
    updateUserData({ plan_tier: data.plan_tier });

    // 4️⃣ WebView'a başarı gönder
    if (webViewRef?.current?.postMessage) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "PREMIUM_GRANTED",
          plan: data.plan_tier,
        })
      );
    }

    toast({
      title: "Tebrikler!",
      description: "Premium üyeliğiniz etkinleştirildi 🎉",
    });

  } catch (e) {
    console.error("❌ Doğrulama Hatası:", e);

    toast({
      variant: "destructive",
      title: "Doğrulama Hatası",
      description: e.message || "Satın alma doğrulanamadı.",
    });

    if (webViewRef?.current?.postMessage) {
      webViewRef.current.postMessage(
        JSON.stringify({ type: "PURCHASE_RESULT", status: "SERVER_ERROR" })
      );
    }
  }
};
