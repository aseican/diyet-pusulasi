import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Req = { query: string; device_id: string };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { query, device_id } = (await req.json()) as Req;
  const q = (query ?? "").trim();
  if (q.length < 2) return new Response(JSON.stringify({ error: "query too short" }), { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  const user_id = userRes?.user?.id ?? null;

  // quota
  const { data: quota, error: qerr } = await supabase.rpc("consume_ai_quota", {
    p_device_id: device_id,
    p_user_id: user_id,
    p_limit_device: 25,
    p_limit_user: 60,
  });

  if (qerr) return new Response(JSON.stringify({ error: qerr.message }), { status: 400 });
  if (quota?.[0]?.allowed !== true) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });

  const prompt = `
User food: "${q}"
Return ONLY valid JSON with keys:
name (string), brand (string or ""), calories (number), protein (number), carbs (number), fat (number).
Assume values are per 100g unless user indicates portion. Use reasonable estimates.
`.trim();

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!r.ok) return new Response(JSON.stringify({ error: "openai_error" }), { status: 502 });

  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";

  let food: any;
  try { food = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "bad_ai_json", raw }), { status: 502 });
  }

  const name = String(food.name ?? q).trim();
  const brand = String(food.brand ?? "").trim();
  const calories = clamp(Number(food.calories ?? 0), 0, 900);
  const protein  = clamp(Number(food.protein  ?? 0), 0, 200);
  const carbs    = clamp(Number(food.carbs    ?? 0), 0, 200);
  const fat      = clamp(Number(food.fat      ?? 0), 0, 200);

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

  if (ierr) return new Response(JSON.stringify({ error: ierr.message }), { status: 400 });

  return new Response(JSON.stringify({ food: inserted?.[0], remaining: quota?.[0]?.remaining ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
});
