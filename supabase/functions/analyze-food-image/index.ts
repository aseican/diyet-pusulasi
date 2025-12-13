// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const QUOTA_LIMITS: Record<string, number> = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 99999,

  // --- GOOGLE PLAY ID EŞLEŞTİRMELERİ ---
  "sub_premium_monthly": 30,    
  "sub_pro_monthly": 50,        
  "sub_unlimited_monthly": 99999 
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_SCOPES = "https://www.googleapis.com/auth/androidpublisher";

const GOOGLE_PLAY_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY') ? JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY')) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function getGoogleAccessToken() {
    if (!GOOGLE_PLAY_SERVICE_ACCOUNT_KEY) {
        throw new Error("Google Service Account Key Secret is missing.");
    }
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: GOOGLE_PLAY_SERVICE_ACCOUNT_KEY.client_email,
        scope: GOOGLE_API_SCOPES,
        aud: GOOGLE_TOKEN_URL,
        exp: now + 3600,
        iat: now,
    };
    const jwtPlaceholder = "manually_generated_jwt_token"; 

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwtPlaceholder,
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

  const supabase = createClient(
    Deno.env.get("PROJECT_URL"),
    Deno.env.get("SECRET_KEY")
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
    
    // ====== SATIN ALMA DOĞRULAMA ENDPOINT'İ ======
    if (url.pathname === "/verify-purchase" && req.method === "POST") {
        try {
            const { purchaseToken, productId, packageName } = await req.json();

            if (!purchaseToken || !productId || !packageName) {
                return new Response(JSON.stringify({ error: "Missing purchase data" }), { 
                    status: 400, headers: corsHeaders 
                });
            }

            const accessToken = await getGoogleAccessToken();
            const googleVerifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}?access_token=${accessToken}`;
            
            const verificationRes = await fetch(googleVerifyUrl, { method: "GET" });
            const verificationData = await verificationRes.json();
            
            if (!verificationRes.ok || !verificationData.expiryTimeMillis || verificationData.subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE') {
                 return new Response(JSON.stringify({ error: "Purchase verification failed (Invalid token or not active).", details: verificationData }), { 
                    status: 400, headers: corsHeaders 
                });
            }

            const { error: updateError } = await supabase
                .from('profiles')
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
                status: 500, headers: corsHeaders,
            });
        }
    }

  // Profil Yükleme
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

  // --- TEST MODU: KOTA KONTROLÜ DEVRE DIŞI ---
  /*
  const today = new Date().toISOString().split("T")[0];
  const lastReset = safeProfile.ai_usage_last_reset?.split("T")[0] ?? null;
  const usage = lastReset === today ? safeProfile.ai_usage_count : 0;

  if (usage >= QUOTA_LIMITS[safeProfile.plan_tier ?? "free"]) {
    return new Response(JSON.stringify({ error: "Quota exceeded" }), {
      status: 429,
      headers: corsHeaders,
    });
  }
  */
  // ------------------------------------------

  // Payload Okuma
  const body = await req.json().catch(() => null);

  if (!body || !body.imageUrl) {
    return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  try {
    // --- TEST MODU: VERİTABANI YAZMA İŞLEMİ DEVRE DIŞI ---
    /*
    await supabase
        .from("profiles")
        .update({
            ai_usage_count: usage + 1,
            ai_usage_last_reset: today,
        })
        .eq("id", user.id);
    */
    // ----------------------------------------------------


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
      {
        type: "text",
        text: `
Bu bir yemek fotoğrafıdır.

Fotoğrafta:
- Bir veya birden fazla yiyecek olabilir
- Türk mutfağı dahil tüm mutfakları düşün
- Emin olmasan bile EN OLASI tahmini yap
- Dürüm, ayran, tatlı, içecek, sos gibi yan ürünleri de dahil et

Her zaman TEK bir JSON döndür.
Asla açıklama yazma.

Alanlar:
- name (Türkçe, açıklayıcı)
- calories (tahmini)
- protein
- carbs
- fat
- quantity (sayısal)
- unit (gram, adet, porsiyon gibi)

Eğer birden fazla ürün varsa:
Ana ürünü seç (örn: Tavuk Dürüm)
Yan ürünleri name içinde belirt (örn: Tavuk Dürüm + Ayran)
`
      },
      {
        type: "image_url",
        image_url: {
          url: body.imageUrl,
          detail: "high"
        }
      }
    ]
  }
]

        }),
    });

    const result = await aiRes.json();

    if (!aiRes.ok || !result?.choices?.[0]?.message?.content) {
        // Hata durumunda kotayı geri al (TEST İÇİN KAPALI)
        // await supabase.from("profiles").update({ ai_usage_count: usage }).eq("id", user.id);

        return new Response(
            JSON.stringify({ error: "OpenAI API failed.", details: result }),
            { status: 500, headers: corsHeaders }
        );
    }

    const parsed = JSON.parse(result.choices[0].message.content.trim());

    return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    // TEST İÇİN GERİ ALMA KAPALI
    // await supabase.from("profiles").update({ ai_usage_count: usage }).eq("id", user.id);

    console.error("❌ FINAL CRASH ERROR:", err.message);
    
    return new Response(JSON.stringify({ error: "Analiz sırasında sunucuya ulaşılamadı. (Lütfen OpenAI faturanızı kontrol edin.)" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});