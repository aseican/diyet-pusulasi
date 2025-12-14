import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Req = { query: string; device_id: string };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stripJsonFences(raw0: unknown) {
  const s = String(raw0 ?? "").trim();
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normCategory(x: unknown) {
  const s = String(x ?? "").trim().toLowerCase();
  const allowed = ["kahvalti", "ana_yemek", "ara_ogun", "icecek", "tatli"];
  return allowed.includes(s) ? s : "ana_yemek";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json(500, { error: "missing_supabase_env" });
    if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 20) return json(500, { error: "missing_openai_key" });

    // JWT verify kapalı varsayımı: auth header kullanmıyoruz
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const supabaseService = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    const body = (await req.json().catch(() => null)) as Req | null;
    const q = String(body?.query ?? "").trim();
    const device_id = String(body?.device_id ?? "").trim();

    if (q.length < 2) return json(400, { error: "query too short" });
    if (device_id.length < 8) return json(400, { error: "bad_device_id" });

    // quota (device bazlı)
    const { data: quota, error: qerr } = await supabaseAnon.rpc("consume_ai_quota", {
      p_device_id: device_id,
      p_user_id: null,
      p_limit_device: 25,
      p_limit_user: 60,
    });

    if (qerr) return json(400, { error: "quota_error", details: qerr.message });
    if (quota?.[0]?.allowed !== true) return json(429, { error: "rate_limited" });

    // ✅ SADECE 100g değerleri üret (porsiyon uydurma yok)
    const prompt = `
Kullanıcı yemeği: "${q}"

SADECE geçerli JSON döndür. Markdown yok. Kod bloğu yok.

Zorunlu anahtarlar:
{
  "name_tr": string,                 // Türkçe isim
  "brand": string,                   // yoksa ""
  "category": "kahvalti" | "ana_yemek" | "ara_ogun" | "icecek" | "tatli",
  "calories": number,                // kcal PER 100g
  "protein": number,                 // g PER 100g
  "carbs": number,                   // g PER 100g
  "fat": number                      // g PER 100g
}

Kurallar:
- Değerler PER 100 gram içindir.
- Gerçekçi aralıklar:
  calories 0-900, protein 0-200, carbs 0-200, fat 0-200.
- Emin değilsen yaygın ortalama kullan.
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
    const raw0 = j?.choices?.[0]?.message?.content ?? "{}";
    const raw = stripJsonFences(raw0);

    let out: any;
    try {
      out = JSON.parse(raw);
    } catch {
      return json(502, { error: "bad_ai_json", raw: raw0 });
    }

    const name_tr = String(out?.name_tr ?? q).trim();
    const brand = String(out?.brand ?? "").trim();
    const category = normCategory(out?.category);

    const calories = clamp(Number(out?.calories ?? 0), 0, 900);
    const protein = clamp(Number(out?.protein ?? 0), 0, 200);
    const carbs = clamp(Number(out?.carbs ?? 0), 0, 200);
    const fat = clamp(Number(out?.fat ?? 0), 0, 200);

    // ✅ DB constraint için nötr default
    const row: Record<string, any> = {
      name_tr,
      brand,
      category,
      calories,
      protein,
      carbs,
      fat,
      portion_label: "100g",
      portion_gram: 100,
    };

    // 1) Service role varsa: direkt insert (en stabil)
    if (supabaseService) {
      const { data: inserted, error: ierr } = await supabaseService
        .from("manual_foods")
        .insert(row)
        .select("*")
        .limit(1);

      if (ierr) return json(400, { error: "db_insert_error", details: ierr.message });
      return json(200, { food: inserted?.[0] ?? null, remaining: quota?.[0]?.remaining ?? null });
    }

    // 2) Service role yoksa: RPC fallback (RPC’nin portion_* alanlarını handle etmesi gerekir)
    const { data: inserted2, error: ierr2 } = await supabaseAnon.rpc("add_manual_food_from_ai", {
      p_name: name_tr,
      p_brand: brand,
      p_calories: calories,
      p_protein: protein,
      p_carbs: carbs,
      p_fat: fat,
      p_device_id: device_id,
      p_user_id: null,
    });

    if (ierr2) return json(400, { error: "db_insert_error", details: ierr2.message });
    return json(200, { food: inserted2?.[0] ?? null, remaining: quota?.[0]?.remaining ?? null });
  } catch (e) {
    return json(500, { error: "internal_error", message: e?.message ?? String(e) });
  }
});
