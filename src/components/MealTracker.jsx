// FINAL FIXED MealTracker.jsx
// - Eski yapıyı korur
// - Manuel + AI akışı TAM
// - Mobile image upload + OpenAI uyumlu
// - Export / build hatası yok

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Plus, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { v4 as uuidv4 } from 'uuid';

const FOOD_BUCKET = 'food-images';

const PLAN_LIMITS = {
  free: 3,
  basic: 10,
  pro: 30,
  kapsamli: 99999,
};

function MealTracker({ addMeal }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState('manual');
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // ---------------- MANUAL SEARCH ----------------
  useEffect(() => {
    if (query.length < 2) {
      setFoods([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('foods')
        .select('*')
        .ilike('name_tr', `%${query}%`)
        .limit(20);
      setFoods(data || []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  // ---------------- AI ANALYZE ----------------
  const analyzeImage = async () => {
    if (!image || !user) return;

    try {
      setAnalyzing(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, ai_usage_count, ai_usage_last_reset')
        .eq('id', user.id)
        .single();

      const today = new Date().toISOString().split('T')[0];
      let used = profile.ai_usage_last_reset === today ? profile.ai_usage_count : 0;
      const limit = PLAN_LIMITS[profile.plan_tier || 'free'];

      if (used >= limit) {
        toast({
          variant: 'destructive',
          title: 'AI Limiti Doldu',
          description: `Günlük limit: ${limit}`,
        });
        return;
      }

      // mobile SAFE upload
      const ext = image.name.split('.').pop();
      const path = `${user.id}/${uuidv4()}.${ext}`;

      await supabase.storage.from(FOOD_BUCKET).upload(path, image, {
        contentType: image.type,
        upsert: false,
      });

      const { data: urlData } = supabase.storage.from(FOOD_BUCKET).getPublicUrl(path);

      const { data: sessionData } = await supabase.auth.getSession();

      const res = await supabase.functions.invoke('analyze-food-image', {
        body: { imageUrl: urlData.publicUrl },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (res.error) throw res.error;

      setAiResult(res.data);

      await supabase.from('profiles').update({
        ai_usage_count: used + 1,
        ai_usage_last_reset: today,
      }).eq('id', user.id);

    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'AI Analiz Başarısız' });
    } finally {
      setAnalyzing(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="p-4 space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="manual">Manuel</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Input
            placeholder="Yiyecek ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {loading && <p className="text-sm">Yükleniyor...</p>}

          <AnimatePresence>
            {foods.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 border rounded-xl flex justify-between mt-2"
              >
                <span>{f.name_tr}</span>
                <Button size="sm" onClick={() => addMeal(f)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="ai" className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0])}
          />

          <Button variant="outline" onClick={() => fileRef.current.click()}>
            <Camera className="mr-2" /> Fotoğraf Seç
          </Button>

          <Button onClick={analyzeImage} disabled={!image || analyzing}>
            {analyzing ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
            Analiz Et
          </Button>

          {aiResult && (
            <pre className="text-xs bg-black/80 text-white p-3 rounded-xl overflow-x-auto">
              {JSON.stringify(aiResult, null, 2)}
            </pre>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MealTracker;
export { MealTracker };
