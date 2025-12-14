import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS ----
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // 🔴 PRE-FLIGHT (BURASI EKSİKTİ)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- AUTH ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }
console.log("ENV CHECK", {
  hasOpenAI: !!Deno.env.get("OPENAI_API_KEY"),
  keyLength: Deno.env.get("OPENAI_API_KEY")?.length,
});

    // ---- ENV ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ---- USER ----
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // ---- BODY ----
    const body = await req.json();

    // ---- OPENAI ----
    const prompt = `
Kullanıcı verilerine göre kısa ama profesyonel bir diyet ve ilerleme analizi yap.

Veriler:
${JSON.stringify(body, null, 2)}

Kurallar:
- Türkçe yaz
- Net, motive edici ve premium ton
- Gereksiz emoji yok
- 3–5 paragraf
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error("OpenAI error: " + t);
    }

    const aiJson = await aiRes.json();
    const insight = aiJson.choices?.[0]?.message?.content || "";

    // ---- LOG USAGE ----
    await supabase.from("ai_usage_logs").insert({
      user_id: user.id,
      feature: "progress_insight",
    });

    // ---- RESPONSE ----
    return new Response(
      JSON.stringify({
        insight,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("FUNCTION ERROR", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Internal error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
