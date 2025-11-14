import { createClient } from 'npm:@supabase/supabase-js@2'

// === 1. KOTA LİMİTLERİNİ TANIMLA ===
// Bu, projenizin iş kurallarını tanımlar
const QUOTA_LIMITS = {
  free: 0,
  basic: 3,
  pro: 7,
  kapsamli: Infinity,
};

// --- Deno Sunucusu Başlangıcı ---
Deno.serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Sadece okuma/yazma için Service Role Key gerekli
  );

  // Kullanıcı kimliğini al (Kimlik doğrulama başlığından)
  const userToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user } } = await supabaseClient.auth.getUser(userToken);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Yetkilendirme başarısız.' }), { status: 401 });
  }

  // === 2. KULLANICI PROFİLİNİ VE KOTASINI KONTROL ET ===
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('plan_tier, ai_usage_count, ai_usage_last_reset')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Kullanıcı profili bulunamadı.' }), { status: 404 });
  }

  // --- KOTA GÜNCELLEME KONTROLÜ ---
  const today = new Date().toISOString().split('T')[0];
  const lastResetDate = profile.ai_usage_last_reset?.split('T')[0];
  let currentUsage = profile.ai_usage_count;

  // Eğer bugün ilk kullanım ve sayaç resetlenmediyse, sıfırla
  if (lastResetDate !== today) {
    currentUsage = 0;
  }

  const limit = QUOTA_LIMITS[profile.plan_tier as keyof typeof QUOTA_LIMITS];

  // === 3. ERİŞİMİ ENGELLE / KOTA KONTROLÜ ===
  if (profile.plan_tier !== 'kapsamli' && currentUsage >= limit) {
    return new Response(JSON.stringify({ 
      error: 'Günlük AI limitiniz doldu.', 
      limit: limit 
    }), { status: 429 }); // 429: Too Many Requests
  }

  // --- KOTA KONTROLÜ GEÇİLDİ ---
  
  // === 4. YENİ KULLANIMI VERİTABANINA YAZ (ÖNCE) ===
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
    return new Response(JSON.stringify({ error: 'Sunucu hatası.' }), { status: 500 });
  }

  // === 5. OPENAI İŞLEMİNİ YAP ===
  // Gerçek AI analizi burada yapılır (Dünkü plandaki gibi görsel analiz)
  const { imageUrl } = await req.json();
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY'); // Güvenli anahtar

  if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI anahtarı eksik.' }), { status: 500 });
  }

  // Burada OpenAI API'si çağrılır ve sonuç döndürülür.
  // Basitlik için sadece bir mockup cevap döndürüyoruz:
  
  const aiResult = {
      name: "Kremalı Mantarlı Makarna",
      calories: 550,
      confidence: "High",
      used_quota: newUsageCount,
      quota_limit: limit
  };
  
  return new Response(
    JSON.stringify(aiResult),
    { headers: { "Content-Type": "application/json" } }
  );
});