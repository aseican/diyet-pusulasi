// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const QUOTA_LIMITS = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 50,
};

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get("PROJECT_URL"),
    Deno.env.get("SERVICE_ROLE_SECRET")
  );

  // Auth token
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // ---- GET USER PROFILE SAFELY ----
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, ai_usage_count, ai_usage_last_reset")
    .eq("id", user.id)
    .maybeSingle();

  // If profile is null → fallback default values
  const safeProfile = profile ?? {
    plan_tier: "free",
    ai_usage_count: 0,
    ai_usage_last_reset: null,
  };

  const today = new Date().toISOString().split("T")[0];
  const lastReset =
    safeProfile.ai_usage_last_reset?.split("T")[0] ?? null;

  const usage =
    lastReset === today ? safeProfile.ai_usage_count : 0;

  if (usage >= QUOTA_LIMITS[safeProfile.plan_tier]) {
    return new Response(JSON.stringify({ error: "Quota exceeded" }), {
      status: 429,
      headers: corsHeaders,
    });
  }

  // Update usage count
  await supabase
    .from("profiles")
    .update({
      ai_usage_count: usage + 1,
      ai_usage_last_reset: today,
    })
    .eq("id", user.id);

  // Read body safely
  const body = await req.json().catch(() => null);
  if (!body || !body.imageUrl) {
    return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // Send request to OpenAI
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
              text: "Bu fotoğrafı analiz et ve JSON formatında detaylı besin bilgisi döndür.",
            },
            {
              type: "image_url",
              image_url: { url: body.imageUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  const result = await aiRes.json();

  if (!result?.choices?.[0]?.message?.content) {
    return new Response(
      JSON.stringify({ error: "AI response error", details: result }),
      { status: 500, headers: corsHeaders }
    );
  }

  const parsed = JSON.parse(result.choices[0].message.content);

  return new Response(JSON.stringify(parsed), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
