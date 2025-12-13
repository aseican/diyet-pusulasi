import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Camera,
  Zap,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = 'food-images';

// Resim boyutlandırma fonksiyonu (daha verimli hale getirildi)
const resizeImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      const scale = Math.min(1, MAX_WIDTH / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject('Resize failed');
          resolve(new File([blob], 'food.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.7
      );
    };

    img.onerror = reject;
  });

function MealTracker() {
  const { user } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('ai');
  const [aiFile, setAiFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Fotoğraf seçimi
  const handleFileSelect = (file) => {
    if (!file) return;
    setAiFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
  };

  // Fotoğraf analizi (AI)
  const handleAnalyze = async () => {
    if (!user || !aiFile || isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      // Resmi boyutlandırma
      const resizedFile = await resizeImage(aiFile);

      const path = `${user.id}/${uuidv4()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(FOOD_BUCKET)
        .upload(path, resizedFile, {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(FOOD_BUCKET)
        .getPublicUrl(path);

      const imageUrl = urlData?.publicUrl;

      const { data: sessionData } = await supabase.auth.getSession();

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 30000); // Zaman aşımı

      // AI analizine çağrı
      const { data, error } = await supabase.functions.invoke(
        'analyze-food-image',
        {
          body: { imageUrl },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          signal: controller.signal,
        }
      );

      if (error) throw error;

      setAnalysisResult(data);

      toast({
        title: 'Analiz tamamlandı',
        description: 'Yiyecek başarıyla analiz edildi',
      });

    } catch (err) {
      console.error(err);

      toast({
        variant: 'destructive',
        title: 'Analiz hatası',
        description: 'Fotoğraf analiz edilemedi, tekrar deneyin',
      });

    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 rounded-xl shadow-lg">

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-1 gap-4">
          <TabsTrigger value="ai" className="text-xl font-semibold text-blue-600">
            AI ile Fotoğraftan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-6">
          
          {/* Fotoğraf Seç */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-6 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Camera className="mr-2" />
            Fotoğraf Seç
          </Button>

          {/* Fotoğraf Önizleme */}
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border rounded-xl p-4 bg-white shadow-md"
            >
              <img
                src={previewUrl}
                alt="preview"
                className="rounded-lg w-full object-cover max-h-64"
              />
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Fotoğraf yüklendi
              </div>
            </motion.div>
          )}

          {/* Analiz Butonu */}
          <Button
            onClick={handleAnalyze}
            disabled={!aiFile || isAnalyzing}
            className="w-full py-3 px-6 bg-green-600 text-white hover:bg-green-700"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                Analiz ediliyor...
              </>
            ) : (
              <>
                <Zap className="mr-2" />
                Analiz Et
              </>
            )}
          </Button>

          {/* Analiz Sonucu */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-xl p-4 bg-white shadow-md"
            >
              <pre className="text-xs whitespace-pre-wrap text-gray-700">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { MealTracker };
export default MealTracker;
