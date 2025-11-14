// Bu dosya: src/lib/calculator.js
// Kalori Hesaplaması: Harris-Benedict (HB) Formülü Kullanılmıştır

// Bazal Metabolizma Hızı (BMR) hesaplaması (Harris-Benedict)
const calculateBMR = (gender, weight, height, age) => {
    if (gender === 'Erkek') {
        // Erkek: 66.5 + (13.75 * W) + (5.003 * H) - (6.755 * A)
        return 66.5 + (13.75 * weight) + (5.003 * height) - (6.755 * age);
    } else { // Kadın
        // Kadın: 655.1 + (9.563 * W) + (1.850 * H) - (4.676 * A)
        return 655.1 + (9.563 * weight) + (1.850 * height) - (4.676 * age);
    }
};

// Aktivite seviyesine göre toplam günlük enerji harcamasını (TDEE) hesaplar
const getActivityMultiplier = (level) => {
    switch (level) {
        case 'Sedentary': // Hareketsiz (çoğunlukla oturarak)
            return 1.2;
        case 'LightlyActive': // Hafif aktif (haftada 1-3 gün egzersiz)
            return 1.375;
        case 'ModeratelyActive': // Orta derecede aktif (haftada 3-5 gün egzersiz)
            return 1.55;
        case 'VeryActive': // Çok aktif (haftada 6-7 gün egzersiz)
            return 1.725;
        default:
            return 1.2;
    }
};

// Nihai Günlük Kalori Hedefini Hesaplama
export const calculateCalorieTarget = (userData) => {
    if (!userData || !userData.gender || !userData.weight || !userData.height || !userData.age || !userData.activity_level) {
        return 2000; // Varsayılan değer
    }

    const bmr = calculateBMR(userData.gender, userData.weight, userData.height, userData.age);
    const tdee = bmr * getActivityMultiplier(userData.activity_level);
    
    // Hedefe göre kalori ayarlaması yap (Kilo vermek/almak)
    let finalTarget = tdee;

    switch (userData.goal_type) {
        case 'Kilo Vermek':
            finalTarget -= 500; // Günlük 500 kalori açık = Haftada 0.5 kg kayıp
            break;
        case 'Kilo Almak':
            finalTarget += 300;
            break;
        // Kilo Korumak için TDEE kullanılır
    }

    // Minimum 1200 kalori kuralı
    return Math.max(1200, Math.round(finalTarget));
};