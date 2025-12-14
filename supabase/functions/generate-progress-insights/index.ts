import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

type Json = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- helpers ----------
function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function utcYMD() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlan(plan: unknown): string {
  const p = String(plan || "free");
  if (["kapsamli", "unlimited", "sub_unlimited_monthly"].includes(p)) return "sub_unlimited_monthly";
  if (["pro", "sub_pro_monthly"].includes(p)) return "sub_pro_monthly";
  if (["premium", "basic", "sub_premium_monthly"].includes(p)) return "sub_premium_monthly";
  return "free";
}

function planLimit(planKey: string): number {
  // Mantıklı limitler:
  // Premium: 3/gün, Pro: 8/gün, Kapsamlı: limitsiz
  if (planKey === "sub_unlimited_monthly") return 999999;
  if (planKey === "sub_pro_monthly") return 8;
  if (planKey === "sub_premium_monthly") return 3;
  return 0;
}

async function callOpenAI(prompt: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Sen bir diyet koçu ve veri analisti gibi davran. Türkçe yaz. Kısa ama premium hissiyatlı. Somut öneriler ver.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const text = await resp.text().catch(() => "");
  if (!resp.ok) {
    throw new Error(`OPENAI_ERROR_${resp.status}:${text.slice(0, 300)}`);
  }

  const j = JSON.parse(text);
  const out = j?.choices?.[0]?.message?.content || "";
  return String(out).trim();
}

// ---------- main ----------
serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_ROLE) {
      return json({ error: "SERVER_MISCONFIGURED" }, 500);
    }

    // ✅ Client (user doğrulaması için anon, db yazma için service role)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) return json({ error: "UNAUTHORIZED", message: "Missing bearer token" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // ✅ user'ı token ile çöz (legacy vs hiç fark etmez)
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return json({ error: "UNAUTHORIZED", message: "Invalid token" }, 401);
    }
    const userId = userRes.user.id;

    // payload
    const body = (await req.json().catch(() => ({}))) as Json;
    const range = (body?.range as Json) || {};
    const stats = (body?.stats as Json) || {};

    // profile çek
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, username, plan_tier, ai_usage_count, last_reset_date")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) throw profErr;
    if (!profile?.id) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    const planKey = normalizePlan(profile.plan_tier);
    const limit = planLimit(planKey);

    if (limit <= 0) {
      return json(
        {
          error: "PREMIUM_REQUIRED",
          message: "Bu özellik premium üyelik gerektirir.",
          plan: planKey,
        },
        403
      );
    }

    // günlük reset
    const today = utcYMD();
    const lastReset = String(profile.last_reset_date || "");
    let usedToday = Number(profile.ai_usage_count || 0);

    if (lastReset !== today) {
      usedToday = 0;
      await admin
        .from("profiles")
        .update({ ai_usage_count: 0, last_reset_date: today })
        .eq("id", userId);
    }

    if (usedToday >= limit) {
      return json(
        {
          error: "LIMIT_REACHED",
          message: "Günlük AI analiz hakkın bitti.",
          usedToday,
          limit,
          remaining: 0,
          plan: planKey,
        },
        429
      );
    }

    // prompt
    const prompt = `
Kullanıcı: ${profile.username || "Kullanıcı"}
Plan: ${planKey}
Tarih aralığı: ${String(range.startDate || "")} - ${String(range.endDate || "")} (gün: ${String(range.daysCount || "")})

İstatistikler:
- Kalori hedefi: ${String(stats.calorieGoal || "")}
- Toplam kalori: ${String(stats.totalCalories || "")}
- Ortalama kalori: ${String(stats.avgCalories || "")}
- Hedef uyum(%): ${String(stats.adherencePct || "")}
- Su (bardak): ${String(stats.waterGlasses || "")}
- Makrolar (g): P=${String((stats as any)?.macros?.protein || "")} K=${String((stats as any)?.macros?.carbs || "")} Y=${String((stats as any)?.macros?.fat || "")}

Kilo:
- Başlangıç: ${String((stats as any)?.weight?.start || "")}
- Şimdi: ${String((stats as any)?.weight?.current || "")}
- Hedef: ${String((stats as any)?.weight?.target || "")}
- VKİ: ${String((stats as any)?.weight?.bmi || "")}

ÇIKTI FORMATI:
1) 3 maddelik "Premium Özet"
2) 3 maddelik "Risk / Problem"
3) 5 maddelik "Net Aksiyon Önerisi"
4) 1 paragraf "Motivasyon / küçük gerçekçi hedef"
`.trim();

    const insightText = await callOpenAI(prompt);

    // usage artır
    const newUsed = usedToday + 1;
    const remaining = Math.max(limit - newUsed, 0);

    await admin
      .from("profiles")
      .update({ ai_usage_count: newUsed, last_reset_date: today })
      .eq("id", userId);

    // log (hata olursa response yine dönecek)
    await admin
      .from("ai_usage_logs")
      .insert([
        {
          user_id: userId,
          kind: "progress_insight",
          range_start: String(range.startDate || today),
          range_end: String(range.endDate || today),
          payload: body,
          response: { insight: insightText },
        },
      ])
      .catch(() => {});

    return json({
      insight: insightText,
      usedToday: newUsed,
      limit,
      remaining,
      plan: planKey,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", message: String(e?.message || e) }, 500);
  }
});
