import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/customSupabaseClient";
import { Loader2, Image as ImageIcon, Upload, Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const FOOD_BUCKET = "food-images";

// Küçük yardımcılar
function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function guessExtFromMime(mime) {
  const t = (mime || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "jpg";
}

function buildMealFromResult(result) {
  // Supabase function sonucu farklı formatlarda gelebilir.
  // Burada mümkün olduğunca esnek bir "meal" nesnesi üretmeye çalışıyoruz.
  // addMeal tarafında ne bekliyorsan onu kolayca uyarlayabilirsin.
  const nowIso = new Date().toISOString();

  // Yaygın olası alan isimleri
  const name =
    result?.foodName ||
    result?.name ||
    result?.title ||
    result?.meal ||
    "Analiz Edilen Öğün";

  const calories =
    result?.calories ??
    result?.kcal ??
    result?.energy_kcal ??
    result?.nutrition?.calories ??
    null;

  const protein =
    result?.protein ??
    result?.protein_g ??
    result?.nutrition?.protein ??
    null;

  const carbs =
    result?.carbs ??
    result?.carbohydrate ??
    result?.carbohydrate_g ??
    result?.nutrition?.carbs ??
    null;

  const fat = result?.fat ?? result?.fat_g ?? result?.nutrition?.fat ?? null;

  return {
    id: uuidv4(),
    created_at: nowIso,
    name,
    calories: typeof calories === "number" ? calories : Number(calories) || null,
    macros: {
      protein: typeof protein === "number" ? protein : Number(protein) || null,
      carbs: typeof carbs === "number" ? carbs : Number(carbs) || null,
      fat: typeof fat === "number" ? fat : Number(fat) || null,
    },
    raw: result, // ham sonucu da sakla
  };
}

export function MealTracker({ addMeal }) {
  const { toast } = useToast();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const nativeAvailable = useMemo(
    () => !!window?.NativeImage?.pickImageFromGallery,
    []
  );

  const log = (msg, data) => {
    const line = `[${new Date().toISOString()}] ${msg}${
      data ? ` ${safeJsonStringify(data)}` : ""
    }`;
    // eslint-disable-next-line no-console
    console.log(line);
    setLogs((p) => [...p, line].slice(-200));
  };

useEffect(() => {
  const receive = async (b64, mime) => {
    try {
      log("Native received", { hasB64: !!b64, mime, len: b64?.length || 0 });

      if (!b64) {
        toast({ title: "Foto seçilmedi" });
        return;
      }

      const safeMime = mime || "image/jpeg";
      const res = await fetch(`data:${safeMime};base64,${b64}`);
      const blob = await res.blob();

      const ext = (safeMime.split("/")[1] || "jpg").toLowerCase();
      const f = new File([blob], `native_${Date.now()}.${ext}`, { type: safeMime });

      if (!f.size) {
        toast({ variant: "destructive", title: "Foto okunamadı (0 byte)" });
        return;
      }

      setFile(f);
      setResult(null);
      toast({ title: "Foto seçildi", description: f.name });
      log("File constructed", { size: f.size, type: f.type });
    } catch (e) {
      log("Native decode failed", { message: e?.message });
      toast({ variant: "destructive", title: "Foto işlenemedi" });
    }
  };

  // ✅ Global error yakala (native JS string'i patlatıyorsa burada görürüz)
  window.onerror = (msg, src, line, col, err) => {
    log("window.onerror", { msg, src, line, col, err: err?.message });
  };
  window.onunhandledrejection = (ev) => {
    log("unhandledrejection", { reason: String(ev?.reason) });
  };

  // ✅ Native hangi ismi çağırırsa çağırsın yakala
  const aliases = [
    "__nativeImagePickResult",
    "nativeImagePickResult",
    "onNativeImagePickResult",
    "onImagePicked",
    "onImagePickResult",
    "receiveNativeImage",
    "NativeImagePickResult",
  ];
  for (const k of aliases) window[k] = receive;

  // ✅ Native bazen window.NativeImage.* üstünden çağırıyor
  window.NativeImage = window.NativeImage || {};
  window.NativeImage.onImagePicked = receive;
  window.NativeImage.onResult = receive;
  window.NativeImage.__nativeImagePickResult = receive;

  // ✅ Eğer native postMessage ile yolluyorsa
  const onMessage = (ev) => {
    try {
      const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      if (data?.b64) receive(data.b64, data.mime);
    } catch {}
  };
  window.addEventListener("message", onMessage);

  log("Native hooks installed", {
    hasNativeBridge: !!window?.NativeImage?.pickImageFromGallery,
  });

  return () => window.removeEventListener("message", onMessage);
}, [toast]);


  const onWebPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    log("Web picked file", { name: f.name, size: f.size, type: f.type });
  };

  const pickFromNative = () => {
    if (!window?.NativeImage?.pickImageFromGallery) {
      toast({
        variant: "destructive",
        title: "Native bridge yok",
        description: "NativeImage.pickImageFromGallery bulunamadı.",
      });
      log("Native bridge missing");
      return;
    }
    log("Calling native picker");
    try {
      window.NativeImage.pickImageFromGallery();
    } catch (e) {
      log("Native picker call failed", { message: e?.message });
      toast({ variant: "destructive", title: "Native picker açılamadı" });
    }
  };

  const uploadToSupabase = async (selectedFile) => {
    const mime = selectedFile?.type || "image/jpeg";
    const ext = guessExtFromMime(mime);
    const filePath = `tmp/${uuidv4()}.${ext}`;

    log("Uploading to storage", {
      bucket: FOOD_BUCKET,
      filePath,
      size: selectedFile.size,
      type: mime,
    });

    const { error: uploadError } = await supabase.storage
      .from(FOOD_BUCKET)
      .upload(filePath, selectedFile, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(FOOD_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = publicData?.publicUrl;
    if (!imageUrl) throw new Error("NO_PUBLIC_URL");

    return { imageUrl, filePath };
  };

  const analyze = async () => {
    if (!file || isAnalyzing || isUploading) return;

    setIsUploading(true);
    setIsAnalyzing(true);
    setResult(null);

    try {
      // 1) Upload
      const { imageUrl } = await uploadToSupabase(file);
      setIsUploading(false);

      // 2) Session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("NO_SESSION");
      }

      log("Calling function analyze-food-image", { imageUrl });

      // 3) Invoke function
      const { data, error } = await supabase.functions.invoke(
        "analyze-food-image",
        {
          body: { imageUrl },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (error) throw error;

      setResult(data);
      log("Analyze success", { keys: data ? Object.keys(data) : null });

      toast({ title: "Analiz tamamlandı" });
    } catch (e) {
      log("Analyze failed", { message: e?.message });
      toast({ variant: "destructive", title: "Analiz başarısız" });
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const pushToApp = () => {
    if (!result) {
      toast({ title: "Önce analiz yap" });
      return;
    }
    if (typeof addMeal !== "function") {
      toast({
        variant: "destructive",
        title: "addMeal bulunamadı",
        description: "App.jsx tarafında prop geçildiğinden emin ol.",
      });
      return;
    }

    try {
      const meal = buildMealFromResult(result);
      addMeal(meal);
      toast({ title: "Öğün eklendi", description: meal.name });
      log("Meal pushed to addMeal()", { mealPreview: { id: meal.id, name: meal.name } });
    } catch (e) {
      log("addMeal failed", { message: e?.message });
      toast({ variant: "destructive", title: "Öğün eklenemedi" });
    }
  };

  const busy = isUploading || isAnalyzing;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div className="space-y-2">
        <div className="text-lg font-semibold">Öğün Ekle (MealTracker)</div>
        <div className="text-sm text-muted-foreground">
          Web’de dosya seç, Android’de native picker varsa onu kullan.
        </div>
      </div>

      {/* Native picker */}
      <Button
        onClick={pickFromNative}
        className="w-full"
        variant={nativeAvailable ? "outline" : "secondary"}
        disabled={!nativeAvailable}
        title={nativeAvailable ? "" : "Native bridge yok"}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Galeriden Foto Seç (Native)
      </Button>

      {/* Web picker */}
      <label className="block">
        <div className="mb-2 text-sm text-muted-foreground">
          Web/PC için dosya seç:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={onWebPick}
            className="block w-full text-sm"
          />
          <Upload className="h-4 w-4 opacity-60" />
        </div>
      </label>

      {/* Selected file info */}
      {file && (
        <div className="text-sm">
          Seçilen dosya: <b>{file.name}</b> ({file.size} bytes)
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="rounded border overflow-hidden">
          <img
            src={previewUrl}
            alt="Seçilen görsel"
            className="w-full h-auto block"
          />
        </div>
      )}

      {/* Analyze */}
      <Button
        onClick={analyze}
        disabled={!file || busy}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isUploading ? "Yükleniyor" : "Analiz Ediliyor"}
          </>
        ) : (
          "Analiz Et"
        )}
      </Button>

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Analiz Sonucu</div>
          <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64">
            {safeJsonStringify(result)}
          </pre>

          {/* addMeal bağlantısı */}
          <Button onClick={pushToApp} className="w-full" variant="default">
            <Plus className="mr-2 h-4 w-4" />
            Öğün Olarak Ekle
          </Button>
        </div>
      )}

      {/* Debug */}
      <details className="text-xs text-gray-500">
        <summary>Debug Log</summary>
        <pre className="whitespace-pre-wrap">{logs.join("\n")}</pre>
      </details>
    </div>
  );
}
