export const SUPABASE_CONFIG = {
  baseUrl: 'https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZmh0dml3Z3JrYnlpdWp4bHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODQ5NTMsImV4cCI6MjA5MTI2MDk1M30.TRxGviX8eZ5kty4th38BPqmkHXhQTEhCZ_1Oki_VGmE',
} as const;

export const API_HEADERS: Record<string, string> = {
  apikey: SUPABASE_CONFIG.anonKey,
  Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
};

export const API_POST_HEADERS: Record<string, string> = {
  ...API_HEADERS,
  'Content-Type': 'application/json',
};

export const API_ENDPOINTS = {
  ventas: `${SUPABASE_CONFIG.baseUrl}/ventas`,
  estado: `${SUPABASE_CONFIG.baseUrl}/estado`,
  stock: `${SUPABASE_CONFIG.baseUrl}/stock`,
  temperatura: `${SUPABASE_CONFIG.baseUrl}/temperatura`,
  productos: `${SUPABASE_CONFIG.baseUrl}/productos`,
  control: `${SUPABASE_CONFIG.baseUrl}/control`,
} as const;
