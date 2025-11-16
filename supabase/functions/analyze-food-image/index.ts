// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const QUOTA_LIMITS = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 50,
};

// Play Billing İçin Gerekli Sabitler
// Burası Edge Function'ın doğru Google API'sini çağırmasını sağlar.
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_SCOPES = "https://www.googleapis.com/auth/androidpublisher";

// Ortam Değişkenleri
const GOOGLE_PLAY_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY') ? JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY')) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Google Play Developer API için JWT kullanarak Access Token alır.
 * @returns {Promise<string>} Access Token
 */
async function getGoogleAccessToken() {
    if (!GOOGLE_PLAY_SERVICE_ACCOUNT_KEY) {
        throw new Error("Google Service Account Key Secret is missing.");
    }
    
    // JWT Başlığı
    const header = {
        alg: "RS256",
        typ: "JWT",
    };

    // JWT Payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: GOOGLE_PLAY_SERVICE_ACCOUNT_KEY.client_email, // Hizmet Hesabı E-posta Adresi
        scope: GOOGLE_API_SCOPES,
        aud: GOOGLE_TOKEN_URL,
        exp: now + 3600, // 1 saat geçerli
        iat: now,
    };

    // JWT'yi imzala (Deno'da manuel imzalama gereklidir)
    // Deno'da karmaşık bir adımdır, harici bir kütüphane veya özel Crypto API kullanımı gerekir.
    // Bu kısmı basitleştirilmiş ve yer tutucu olarak bırakıyoruz. Gerçek bir implementasyon, 
    // Deno'nun Web Crypto API'si ile "RSASSA-PKCS1-v1_5" algoritması ve özel anahtarı (private_key) gerektirir.
    
    // Güvenlik ve karmaşıklıktan dolayı, bu örnekte basitleştirilmiş bir akış izleyelim.
    // Gerçek bir üretim ortamında bu adımı doğru şekilde kodlamalısınız.
    
    // Geçici olarak, sadece yer tutucu bir token alımı yapalım (Bu, API'ye erişemeyecektir)
    // GERÇEK ÜRETİM KODU BURADA FARKLI OLACAKTIR
    const jwtPlaceholder = "manually_generated_jwt_token"; 

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwtPlaceholder, // Gerçek JWT Token'ınız
        }),
    });

    const data = await response.json();

    if (data.error) {
        console.error("Google Token Error:", data);
        throw new Error("Could not obtain Google Access Token.");
    }

    return data.access_token;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const url = new URL(req.url);

  // Init Supabase (Service Role Key ile)
  const supabase = createClient(
    Deno.env.get("PROJECT_URL"),
    Deno.env.get("SECRET_KEY")
  );

  // Auth & Token Alımı (Tüm yollar için gerekli)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
    
    // ====== YENİ: SATIN ALMA DOĞRULAMA ENDPOINT'İ ======
    if (url.pathname === "/verify-purchase" && req.method === "POST") {
        try {
            const { purchaseToken, productId, packageName } = await req.json();

            if (!purchaseToken || !productId || !packageName) {
                return new Response(JSON.stringify({ error: "Missing purchase data" }), { 
                    status: 400, 
                    headers: corsHeaders 
                });
            }

            const accessToken = await getGoogleAccessToken();

            // Google Play Developer API Endpoint'i (Örn: Subscription için)
            // Tek seferlik ürünler için endpoint biraz farklıdır.
            const googleVerifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}?access_token=${accessToken}`;
            
            // Satın Alma Doğrulama İsteği
            const verificationRes = await fetch(googleVerifyUrl, { method: "GET" });
            const verificationData = await verificationRes.json();
            
            // Eğer yanıt 200 (OK) değilse veya 'expiryTimeMillis' yoksa hata var demektir.
            // Google'ın yanıtları çok karmaşıktır. Basit bir kontrol yapalım:
            if (!verificationRes.ok || !verificationData.expiryTimeMillis || verificationData.subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE') {
                 return new Response(JSON.stringify({ error: "Purchase verification failed (Invalid token or not active).", details: verificationData }), { 
                    status: 400, 
                    headers: corsHeaders 
                });
            }

            // Doğrulama Başarılı! Supabase Veritabanını Güncelle
            const { error: updateError } = await supabase
                .from('profiles')
                // Plan seviyesini, satın alınan ürüne göre güncelleyin.
                .update({ plan_tier: productId, is_premium: true }) 
                .eq('id', user.id);

            if (updateError) throw updateError;

            return new Response(JSON.stringify({ status: 'success', plan_tier: productId }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (error) {
            console.error("❌ PURCHASE VERIFICATION ERROR:", error.message);
            return new Response(JSON.stringify({ error: `Verification failed: ${error.message}` }), {
                status: 500,
                headers: corsHeaders,
            });
        }
    }
    // ====== YENİ: SATIN ALMA DOĞRULAMA ENDPOINT'İ SONU ======


  // Profil Yükleme (Kota için)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, ai_usage_count, ai_usage_last_reset")
    .eq("id", user.id)
    .maybeSingle();

  const safeProfile = profile ?? {
    plan_tier: "free",
    ai_usage_count: 0,
    ai_usage_last_reset: null,
  };
// ... (Geri kalan kota ve OpenAI mantığı aynı kalır)
// ...

// Eğer istek, '/verify-purchase' değilse, normal AI mantığı çalışır.
  const today = new Date().toISOString().split("T")[0];
  const lastReset = safeProfile.ai_usage_last_reset?.split("T")[0] ?? null;

  const usage = lastReset === today ? safeProfile.ai_usage_count : 0;

  if (usage >= QUOTA_LIMITS[safeProfile.plan_tier ?? "free"]) {
    return new Response(JSON.stringify({ error: "Quota exceeded" }), {
      status: 429,
      headers: corsHeaders,
    });
  }

  // Payload Okuma
  const body = await req.json().catch(() => null);

  if (!body || !body.imageUrl) {
    return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // === KRİTİK İŞLEM BAŞLANGICI (OpenAI) ===
  try {
    // KULLANIMI ARTTIR (Önce artırıyoruz, hata olursa geri alırız)
    await supabase
        .from("profiles")
        .update({
            ai_usage_count: usage + 1,
            ai_usage_last_reset: today,
        })
        .eq("id", user.id);


    // OPENAI İSTEĞİ
    const aiRes = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Bu fotoğrafı analiz et ve sadece JSON formatında besin bilgisi döndür. Anahtar kelimeler: name, calories, protein, carbs, fat, quantity, unit. Türkçe kullan." },
                        { type: "image_url", image_url: { url: body.imageUrl, detail: "low" } },
                    ],
                },
            ],
        }),
    });

    const result = await aiRes.json();

    if (!aiRes.ok || !result?.choices?.[0]?.message?.content) {
        // Hata durumunda kotayı geri al
        await supabase.from("profiles").update({ ai_usage_count: usage }).eq("id", user.id);

        return new Response(
            JSON.stringify({ error: "OpenAI API failed.", details: result }),
            { status: 500, headers: corsHeaders }
        );
    }

    // JSON AYRIŞTIRMA (Parser hatası verirse yakala)
    const parsed = JSON.parse(result.choices[0].message.content.trim());

    // Başarılı Cevap
    return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    // SUNUCU ÇÖKMESİNDE VEYA JSON PARSE HATASINDA KOTAYI GERİ AL
    await supabase.from("profiles").update({ ai_usage_count: usage }).eq("id", user.id);

    console.error("❌ FINAL CRASH ERROR:", err.message);
    
    // Hata mesajını kullanıcıya temiz bir şekilde gönder
    return new Response(JSON.stringify({ error: "Analiz sırasında sunucuya ulaşılamadı. (Lütfen OpenAI faturanızı kontrol edin.)" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});