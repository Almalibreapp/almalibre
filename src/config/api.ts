// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN ENDPOINTS EXTERNOS SUPABASE
// NO modificar estas URLs - están desplegadas y funcionando
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZmh0dml3Z3JrYnlpdWp4bHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODQ5NTMsImV4cCI6MjA5MTI2MDk1M30.TRxGviX8eZ5kty4th38BPqmkHXhQTEhCZ_1Oki_VGmE';

export const API_CONFIG = {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  } as Record<string, string>,
  postHeaders: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  } as Record<string, string>,
  endpoints: {
    ventas: `${SUPABASE_URL}/ventas`,
    estado: `${SUPABASE_URL}/estado`,
    stock: `${SUPABASE_URL}/stock`,
    temperatura: `${SUPABASE_URL}/temperatura`,
    productos: `${SUPABASE_URL}/productos`,
    control: `${SUPABASE_URL}/control`,
    cupones: `${SUPABASE_URL}/cupones`,
  },
};
