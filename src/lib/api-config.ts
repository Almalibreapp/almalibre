const SUPABASE_FUNCTIONS_URL = 'https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZmh0dml3Z3JrYnlpdWp4bHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyODcwODMsImV4cCI6MjA1OTg2MzA4M30.z5O3od_gSXkpOr6SHmYE6uhwvvHPJJJuwwN6f32zaFs';

export const API_HEADERS: Record<string, string> = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const API_ENDPOINTS = {
  ventas: `${SUPABASE_FUNCTIONS_URL}/ventas`,
  estado: `${SUPABASE_FUNCTIONS_URL}/estado`,
  stock: `${SUPABASE_FUNCTIONS_URL}/stock`,
  temperatura: `${SUPABASE_FUNCTIONS_URL}/temperatura`,
  productos: `${SUPABASE_FUNCTIONS_URL}/productos`,
  control: `${SUPABASE_FUNCTIONS_URL}/control`,
} as const;
