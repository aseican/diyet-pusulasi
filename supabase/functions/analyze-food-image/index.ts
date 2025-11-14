// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const QUOTA_LIMITS = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 50,
};

Deno.serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('PROJECT_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_KEY') ?? ''
  );

  // Kullanıcı doğrula
  const userToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user } } = await supabaseClient.auth.getUser(userToken);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Profil + kota
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('plan_tier, ai_usage_count, ai_usage_last_reset')
    .eq('id', user.id)
    .maybeSingle();

  const today = new Date().toISOString().split('T')[0];
  const lastReset = profile.ai_usage_last_reset?.split('T')[0];
  let usage = profile.ai_usage_count;

  if (lastReset !== today) usage = 0;

  const limit = QUOTA_LIMITS[profile.plan_tier];

  if (usage >= limit) {
    return new Response(JSON.stringify({ error: 'Quota exceeded' }), { status: 429 });
  }

  // sayaç artır
  await supabaseClient
    .from('profiles')
    .update({
      ai_usage_count: usage + 1,
      ai_usage_last_reset: today
    })
    .eq('id', user.id);

  // ----- OpenAI Request -----
  const body = await req.json();
  const imageUrl = body.imageUrl;

  console.log("OpenAI'ye gönderilen URL:", imageUrl);

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
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
Bu bir yemek fotoğrafı. Aşağıdaki gibi JSON döndür:

{
  "name": "Yemek Adı",
  "calories": 450,
  "protein": 30,
  "carbs": 5,
  "fat": 20,
  "quantity": 180,
  "unit": "gram"
}

Yemek adı Türkçe olsun.
`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" }
            }
          ]
        }
      ]
    }),
  });

  const data = await response.json();
  console.log("OpenAI cevabı:", data);

  if (!response.ok) {
    return new Response(JSON.stringify({ error: "OpenAI Error" }), { status: 500 });
  }

  const parsed = JSON.parse(data.choices[0].message.content);

  return new Response(JSON.stringify(parsed), {
    headers: { "Content-Type": "application/json" }
  });
});
