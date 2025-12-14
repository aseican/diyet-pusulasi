import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/customSupabaseClient";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const FOOD_BUCKET = "food-images";

const isMobileUA = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

function AiFoodAnalyzer() {
  const { toast } = useToast();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const isMobile = useMemo(() => isMobileUA(), []);
  const hasNative = useMemo(() => !!window?.NativeImage?.pickImageFromGallery, []);

  const log = (msg, data) => {
    const line = `[${new Date().toISOString()}] ${msg} ${data ? JSON.stringify(data) : ""}`;
    console.log(line);
    setLogs((p) => [...p, line]);
  };

  // Native callback
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

        log("File constructed (native)", { size: f.size, type: f.type });

        if (!f.size) {
          toast({ variant: "destructive", title: "Foto okunamadı (0 byte)" });
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

  // Desktop input handler (mobile'de ignore)
  const onInputChange = (e) => {
    if (isMobile) {
      log("Ignoring input change on mobile");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const f = e.target.files?.[0];
    log("File picked (input)", { name: f?.name, type: f?.type, size: f?.size });

    if (!f || !f.size) {
      toast({ variant: "destructive", title: "Dosya alınamadı" });
      return;
    }

    setFile(f);
    setResult(null);
  };

  // Unified pick
  const pickPhoto = () => {
    // Mobile: native zorunlu
    if (isMobile) {
      if (!window?.NativeImage?.pickImageFromGallery) {
        toast({
          variant: "destructive",
          title: "Native bridge yok",
          description:
            "Bu ekran mobil WebView içinde native picker olmadan foto seçemez. (Chrome/Safari’de deneyin ya da bridge’i ekleyin.)",
        });
        return;
      }
      log("Calling native picker");
      window.NativeImage.pickImageFromGallery();
      return;
    }

    // Desktop: file input
    inputRef.current?.click();
  };

  const analyze = async () => {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      if (!file.size) throw new Error("EMPTY_FILE");

      const extFromType = (file.type || "").split("/")[1] || "jpg";
      const filePath = `tmp/${uuidv4()}.${extFromType}`;

      log("Uploading", { filePath, size: file.size, type: file.type });

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(filePath, file, { contentType: file.type || "image/jpeg", upsert: false });

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
      {/* Desktop-only hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInputChange}
      />

      <Button onClick={pickPhoto} className="w-full" variant="outline">
        <ImageIcon className="mr-2 h-4 w-4" />
        {isMobile ? "Galeriden Foto Seç (Native)" : "Galeriden Foto Seç"}
      </Button>

      {isMobile && (
        <div className="text-xs text-gray-500">
          Native bridge: <b>{hasNative ? "VAR" : "YOK"}</b>
        </div>
      )}

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

export const MealTracker = () => <AiFoodAnalyzer />;
