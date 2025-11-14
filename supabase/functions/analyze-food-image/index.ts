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
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Supabase client
  const supabase = createClient(
    Deno.env.get("PROJECT_URL"),
    Deno.env.get("SERVICE_ROLE_SECRET")
  );

  // Auth
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Profile & Quota
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, ai_usage_count, ai_usage_last_reset")
    .eq("id", user.id)
    .maybeSingle();

  const today = new Date().toISOString().split("T")[0];
  const lastReset = profile.ai_usage_last_reset?.split("T")[0];
  const usage = lastReset === today ? profile.ai_usage_count : 0;

  if (usage >= QUOTA_LIMITS[profile.plan_tier ?? "free"]) {
    return new Response(JSON.stringify({ error: "Quota exceeded" }), {
      status: 429,
      headers: corsHeaders,
    });
  }

  await supabase
    .from("profiles")
    .update({
      ai_usage_count: usage + 1,
      ai_usage_last_reset: today,
    })
    .eq("id", user.id);

  // Body parse (BURADA SENDE EKSİK VARMIŞ)
  const { imageUrl } = await req.json();

  // OpenAI Request
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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
            { type: "text", text: "Bu fotoğrafı analiz et ve JSON döndür." },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
    }),
  });

  const result = await aiRes.json();
  const parsed = JSON.parse(result.choices[0].message.content);

  return new Response(JSON.stringify(parsed), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
