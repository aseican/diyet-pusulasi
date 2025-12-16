import { Capacitor } from "@capacitor/core";
import { AdMob, InterstitialAdPluginEvents } from "@capacitor-community/admob";

const INTERSTITIAL_ANDROID = "ca-app-pub-3033052396800988/1062575232"; // senin Ad Unit ID
const MEAL_AD_KEY = "meal_ad_count";

let ready = false;

export async function admobInit() {
  if (!Capacitor.isNativePlatform()) return;

  await AdMob.initialize();

  AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
    ready = true;
  });

  AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
    ready = false;
  });

  await AdMob.prepareInterstitial({
    adId: INTERSTITIAL_ANDROID,
    isTesting: true, // PROD'da false yapacağız
  });
}

// Interstitial göster (hazırsa). Plan tier kontrolü YOK.
export async function showInterstitial() {
  if (!Capacitor.isNativePlatform()) return;
  if (!ready) return;

  try {
    await AdMob.showInterstitial();
  } finally {
    ready = false;
    try {
      await AdMob.prepareInterstitial({
        adId: INTERSTITIAL_ANDROID,
        isTesting: true,
      });
    } catch {}
  }
}

// Her 5 öğün kaydında 1 kez reklam göster (tüm planlarda)
export async function showAdEvery5Meals() {
  if (!Capacitor.isNativePlatform()) return;

  const current = Number(localStorage.getItem(MEAL_AD_KEY) || 0) + 1;
  localStorage.setItem(MEAL_AD_KEY, String(current));

  if (current % 5 !== 0) return;

  await showInterstitial();
}
