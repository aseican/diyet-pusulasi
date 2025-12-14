import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Req = { query: string; device_id: string };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json(500, { error: "missing_supabase_env" });
    }

    if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 20) {
      return json(500, { error: "missing_openai_key" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { query, device_id } = (await req.json()) as Req;
    const q = (query ?? "").trim();
    if (q.length < 2) return json(400, { error: "query too short" });
    if (!device_id || String(device_id).trim().length < 8) return json(400, { error: "bad_device_id" });

    // user (opsiyonel)
    const { data: userRes } = await supabase.auth.getUser();
    const user_id = userRes?.user?.id ?? null;

    // quota
    const { data: quota, error: qerr } = await supabase.rpc("consume_ai_quota", {
      p_device_id: device_id,
      p_user_id: user_id,
      p_limit_device: 25,
      p_limit_user: 60,
    });

    if (qerr) return json(400, { error: "quota_error", details: qerr.message });
    if (quota?.[0]?.allowed !== true) return json(429, { error: "rate_limited" });

    const prompt = `
User food: "${q}"
Return ONLY valid JSON with keys:
name (string), brand (string or ""), calories (number), protein (number), carbs (number), fat (number).
Assume values are per 100g unless user indicates portion. Use reasonable estimates.
`.trim();

    let r: Response;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (e) {
      return json(502, { error: "openai_fetch_failed", message: e?.message ?? String(e) });
    }

    if (!r.ok) {
      const details = await r.text().catch(() => "");
      return json(502, { error: "openai_error", status: r.status, details });
    }

    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content ?? "{}";

    let food: any;
    try {
      food = JSON.parse(raw);
    } catch {
      return json(502, { error: "bad_ai_json", raw });
    }

    const name = String(food.name ?? q).trim();
    const brand = String(food.brand ?? "").trim();
    const calories = clamp(Number(food.calories ?? 0), 0, 900);
    const protein = clamp(Number(food.protein ?? 0), 0, 200);
    const carbs = clamp(Number(food.carbs ?? 0), 0, 200);
    const fat = clamp(Number(food.fat ?? 0), 0, 200);

    const { data: inserted, error: ierr } = await supabase.rpc("add_manual_food_from_ai", {
      p_name: name,
      p_brand: brand,
      p_calories: calories,
      p_protein: protein,
      p_carbs: carbs,
      p_fat: fat,
      p_device_id: device_id,
      p_user_id: user_id,
    });

    if (ierr) return json(400, { error: "db_insert_error", details: ierr.message });

    return json(200, { food: inserted?.[0], remaining: quota?.[0]?.remaining ?? null });
  } catch (e) {
    return json(500, { error: "internal_error", message: e?.message ?? String(e) });
  }
});
