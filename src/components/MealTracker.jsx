import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/customSupabaseClient";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const FOOD_BUCKET = "food-images";

function AiFoodAnalyzer() {
  const { toast } = useToast();

  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const log = (msg, data) => {
    const line = `[${new Date().toISOString()}] ${msg} ${
      data ? JSON.stringify(data) : ""
    }`;
    console.log(line);
    setLogs((p) => [...p, line]);
  };

  useEffect(() => {
    window.__nativeImagePickResult = async (b64, mime) => {
      try {
        log("Native callback received", { hasB64: !!b64, mime, len: b64?.length || 0 });

        if (!b64) {
          toast({ title: "Foto seçilmedi" });
          return;
        }

        const safeMime = mime || "image/jpeg";
        const res = await fetch(`data:${safeMime};base64,${b64}`);
        const blob = await res.blob();

        const ext = safeMime.split("/")[1] || "jpg";
        const f = new File([blob], `photo.${ext}`, { type: safeMime });

        log("File constructed", { size: f.size, type: f.type });

        if (!f.size) {
          toast({ variant: "destructive", title: "Foto okunamadı" });
          return;
        }

        setFile(f);
        setResult(null);
      } catch (e) {
        log("Native decode error", { message: e?.message });
        toast({ variant: "destructive", title: "Foto işlenemedi" });
      }
    };

    return () => {
      window.__nativeImagePickResult = undefined;
    };
  }, [toast]);

  const pickPhoto = () => {
    if (!window?.NativeImage?.pickImageFromGallery) {
      toast({
        variant: "destructive",
        title: "Desteklenmeyen ortam",
        description: "Bu özellik sadece mobil uygulamada çalışır.",
      });
      return;
    }

    log("Calling native picker");
    window.NativeImage.pickImageFromGallery();
  };

  const analyze = async () => {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      const fileName = `${uuidv4()}.jpg`;
      const filePath = `tmp/${fileName}`;

      log("Uploading", { filePath, size: file.size });

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(filePath);
      const imageUrl = publicData?.publicUrl;
      if (!imageUrl) throw new Error("NO_PUBLIC_URL");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("NO_SESSION");

      log("Calling function");

      const { data, error } = await supabase.functions.invoke("analyze-food-image", {
        body: { imageUrl },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setResult(data);
      log("Analyze success", data);
    } catch (e) {
      log("Analyze failed", { message: e?.message });
      toast({ variant: "destructive", title: "Analiz başarısız" });
    }

    setIsAnalyzing(false);
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <Button onClick={pickPhoto} className="w-full" variant="outline">
        <ImageIcon className="mr-2 h-4 w-4" />
        Galeriden Foto Seç
      </Button>

      {file && (
        <div className="text-sm text-gray-600">
          Seçilen dosya: <b>{file.name}</b> ({file.size} bytes)
        </div>
      )}

      <Button
        onClick={analyze}
        disabled={!file || isAnalyzing}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analiz Ediliyor
          </>
        ) : (
          "Analiz Et"
        )}
      </Button>

      {result && (
        <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <details className="text-xs text-gray-500">
        <summary>Debug Log</summary>
        <pre className="whitespace-pre-wrap">{logs.join("\n")}</pre>
      </details>
    </div>
  );
}

// ✅ App.jsx bunu bekliyor:
export const MealTracker = () => {
  return <AiFoodAnalyzer />;
};
