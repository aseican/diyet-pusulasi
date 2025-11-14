// @ts-nocheck 
import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// === KOTA LİMİTLERİ ===
const QUOTA_LIMITS = {
  free: 3, 
  basic: 10,
  pro: 30,
  kapsamli: 50,
};

// --- Deno Sunucusu Başlangıcı ---
Deno.serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('PROJECT_URL') ?? '', // FIX: Custom PROJECT_URL'i okuyor
    Deno.env.get('SERVICE_ROLE_KEY') ?? '', // FIX: Custom SERVICE_ROLE_KEY'i okuyor
  );

  // Kullanıcı kimliğini al
  const userToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user } } = await supabaseClient.auth.getUser(userToken);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Yetkilendirme başarısız.' }), { status: 401 });
  }

  // --- KOTA KONTROLÜ VE ARTIŞ MANTIĞI ---
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('plan_tier, ai_usage_count, ai_usage_last_reset')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Kullanıcı profili bulunamadı.' }), { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const lastResetDate = profile.ai_usage_last_reset?.split('T')[0];
  let currentUsage = profile.ai_usage_count;

  if (lastResetDate !== today) {
    currentUsage = 0; 
  }

  const limit = QUOTA_LIMITS[profile.plan_tier as keyof typeof QUOTA_LIMITS];

  // KOTA KONTROLÜ
  if (currentUsage >= limit) {
    return new Response(JSON.stringify({ error: 'Günlük AI limitiniz doldu.' }), { status: 429 }); 
  }

  // KULLANIM SAYACINI ARTTIR
  const newUsageCount = currentUsage + 1;
  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ 
      ai_usage_count: newUsageCount,
      ai_usage_last_reset: today
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Kullanım sayacı güncelleme hatası:', updateError);
  }
  
  // === OPENAI API İŞLEMİNİ YAP (GERÇEK ANALİZ) ===
  const { imageUrl } = await req.json();
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI anahtarı sunucuda eksik.' }), { status: 500 });
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Bu resimdeki ana yemeği, kalorisini, protein, karbonhidrat ve yağ miktarını tahmin et. Porsiyonu (quantity) ve birimini (unit) gram olarak tahmin et. Sadece aşağıdaki JSON formatında Türkçe cevap ver: {"name": "Yemek Adı", "calories": 450, "protein": 30, "carbs": 5, "fat": 20, "quantity": 180, "unit": "gram"}' },
              { type: 'image_url', image_url: { url: imageUrl, detail: "low" } }
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('OpenAI API Hatası:', data);
        // Hata durumunda kotayı geri almalıyız
        await supabaseClient.from('profiles').update({ ai_usage_count: currentUsage }).eq('id', user.id); 
        return new Response(JSON.stringify({ error: 'AI analizinde hata oluştu. (Lütfen OpenAI faturanızı kontrol edin.)' }), { status: 500 });
    }

    // OpenAI'dan gelen JSON metnini parse et
    const aiJson = JSON.parse(data.choices[0].message.content.trim());
    
    // Uygulamanın beklediği veriyi döndür
    return new Response(
      JSON.stringify(aiJson),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Ağ veya parsing hatası durumunda kotayı geri al
    await supabaseClient.from('profiles').update({ ai_usage_count: currentUsage }).eq('id', user.id); 
    console.error("Genel Hata:", error);
    return new Response(JSON.stringify({ error: 'Sunucu bağlantı hatası.' }), { status: 500 });
  }
});