// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("PROJECT_URL"),          // <-- sadece ENV adı
  Deno.env.get("SERVICE_ROLE_SECRET")      // <-- sadece ENV adı
);

const KCAL_PER_KG = 7000;

Deno.serve(async () => {
  console.log("🕛 Daily reset cron çalıştı!");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*");

  if (error) {
    console.error("Profil hata:", error);
    return new Response("Error fetching profiles", { status: 500 });
  }

  for (const user of profiles) {
    const todayCalories = user.today_calories ?? 0;

    const kgLoss = todayCalories / KCAL_PER_KG;

    // Günlük geçmiş kayıt
    await supabase.from("daily_stats").insert({
      user_id: user.id,
      date: new Date().toISOString(),
      calories: todayCalories,
      protein: user.today_protein,
      carbs: user.today_carbs,
      fat: user.today_fat,
      weight_change: kgLoss
    });

    // Günlük istatistikleri sıfırla
    await supabase.from("profiles")
      .update({
        today_calories: 0,
        today_protein: 0,
        today_fat: 0,
        today_carbs: 0,
        weight: user.weight - kgLoss
      })
      .eq("id", user.id);
  }

  return new Response("DAILY RESET COMPLETED ✔");
});
