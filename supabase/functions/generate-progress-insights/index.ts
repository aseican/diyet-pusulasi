import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  sub_premium_monthly: 3,
  sub_pro_monthly: 10,
  sub_unlimited_monthly: Number.POSITIVE_INFINITY,
};

function normalizePlan(plan?: string | null) {
  if (!plan) return "free";
  const p = plan.toString().trim().toLowerCase();

  if (["sub_unlimited_monthly", "kapsamli", "kapsamlı", "unlimited"].includes(p)) return "sub_unlimited_monthly";
  if (["sub_pro_monthly", "pro"].includes(p)) return "sub_pro_monthly";
  if (["sub_premium_monthly", "premium", "basic"].includes(p)) return "sub_premium_monthly";

  return "free";
}

function todayYMDLocal() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "MISSING_SUPABASE_ENV" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "MISSING_OPENAI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED_NO_AUTH_HEADER" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ 1) user client (anon + auth header)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ 2) admin client (service role)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Profile (plan)
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("plan_tier")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      return new Response(
        JSON.stringify({ error: "PROFILE_FETCH_FAILED", details: profErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const planKey = normalizePlan(profile?.plan_tier);
    const dailyLimit = PLAN_LIMITS[planKey] ?? 0;

    if (dailyLimit === 0) {
      return new Response(
        JSON.stringify({ error: "PLAN_REQUIRED", plan: planKey }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Usage count today
    const today = todayYMDLocal();

    const { count: usedCount, error: countErr } = await adminClient
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "progress_insight")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    if (countErr) {
      return new Response(
        JSON.stringify({ error: "USAGE_COUNT_FAILED", details: countErr.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const used = usedCount ?? 0;

    if (dailyLimit !== Number.POSITIVE_INFINITY && used >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: "LIMIT_REACHED", remaining: 0 }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // OpenAI call
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Sen bir diyetisyen ve alışkanlık analizi uzmanısın. Türkçe cevap ver. Bilimsel ama anlaşılır ol. Yanıtı SADECE JSON olarak döndür.",
          },
          {
            role: "user",
            content: `
Aşağıdaki verilere göre DETAYLI analiz üret.

İstenen JSON şeması:
{
  "summary": "2-4 cümle",
  "highlights": ["5-10 madde"],
  "recommendations": ["5-10 net aksiyon"],
  "hydration_analysis": "1 paragraf",
  "macro_analysis": { "protein": "...", "carbs": "...", "fat": "..." },
  "behavior_patterns": ["3-8 madde"],
  "risks": ["0-6 madde"],
  "next_week_plan": ["3-6 madde"]
}

VERİ:
${JSON.stringify(body, null, 2)}
            `,
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: "OPENAI_FAILED", details: errText.slice(0, 500) }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const aiJson = await openaiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";

    let insight: any;
    try {
      insight = JSON.parse(content);
    } catch {
      insight = { summary: content };
    }

    // Log usage
    const { error: logErr } = await adminClient.from("ai_usage_logs").insert({
      user_id: user.id,
      kind: "progress_insight",
    });

    if (logErr) {
      // Analizi döndür, log atılamadıysa sadece uyar
      return new Response(
        JSON.stringify({
          insight,
          warning: "USAGE_LOG_INSERT_FAILED",
          remaining:
            dailyLimit === Number.POSITIVE_INFINITY ? Infinity : Math.max(dailyLimit - (used + 1), 0),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const remaining =
      dailyLimit === Number.POSITIVE_INFINITY ? Infinity : Math.max(dailyLimit - (used + 1), 0);

    return new Response(
      JSON.stringify({ insight, remaining }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR", details: String(e?.message || e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
