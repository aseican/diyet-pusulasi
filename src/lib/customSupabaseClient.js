import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hacfysevszmhkanaxajt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhY2Z5c2V2c3ptaGthbmF4YWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzIzNjgsImV4cCI6MjA3ODM0ODM2OH0.tpUCGgcaa1Jj-fEhUvoLxbHesY6EnQjJnmjnXQQux-w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);