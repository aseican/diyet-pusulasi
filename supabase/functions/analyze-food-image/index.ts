// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const QUOTA_LIMITS = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 50,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Init Supabase (Service Role Key ile)
  const supabase = createClient(
    Deno.env.get("PROJECT_URL"),
    Deno.env.get("SECRET_KEY")
  );

  // Auth & Token Alımı
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

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

  // === KRİTİK İŞLEM BAŞLANGICI ===
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