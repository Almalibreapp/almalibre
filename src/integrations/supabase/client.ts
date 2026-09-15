// Backend propio (proyecto Supabase externo nrfhtviwgrkbyiujxlrd).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SUPABASE_URL = 'https://nrfhtviwgrkbyiujxlrd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZmh0dml3Z3JrYnlpdWp4bHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODQ5NTMsImV4cCI6MjA5MTI2MDk1M30.TRxGviX8eZ5kty4th38BPqmkHXhQTEhCZ_1Oki_VGmE';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
