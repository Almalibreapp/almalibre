import { createClient } from '@supabase/supabase-js';

// Cliente de solo lectura hacia el proyecto de Alma (sistema de soporte)
const ALMA_URL = 'https://ypczixreownzxwzsnnkm.supabase.co';
const ALMA_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwY3ppeHJlb3duenh3enNubmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzIwODgsImV4cCI6MjEwMTUwODA4OH0.x4EBiy_7HsPxkvEdke0Fhe75GOJQPFTAj_y4cAYICBI';

export const almaClient = createClient(ALMA_URL, ALMA_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
