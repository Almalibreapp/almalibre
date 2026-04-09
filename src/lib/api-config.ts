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

const LOCAL_BASE_URL = 'https://lwruwpwdrkmtgcapnbzc.supabase.co/functions/v1';

export const LOCAL_API_HEADERS: Record<string, string> = {
  apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cnV3cHdkcmttdGdjYXBuYnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODE3MTEsImV4cCI6MjA4MTM1NzcxMX0.h-EOEzvaKc0I_xWhxXB3ydy1v7OPSfRxKpehjWbbx5s',
  Authorization:
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cnV3cHdkcmttdGdjYXBuYnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODE3MTEsImV4cCI6MjA4MTM1NzcxMX0.h-EOEzvaKc0I_xWhxXB3ydy1v7OPSfRxKpehjWbbx5s',
};

export const LOCAL_API_POST_HEADERS: Record<string, string> = {
  ...LOCAL_API_HEADERS,
  'Content-Type': 'application/json',
};

export const LOCAL_API_ENDPOINTS = {
  stock: `${LOCAL_BASE_URL}/stock`,
  temperatura: `${LOCAL_BASE_URL}/temperatura`,
  productos: `${LOCAL_BASE_URL}/productos`,
} as const;

export const API_ENDPOINTS = {
  ventas: `${SUPABASE_CONFIG.baseUrl}/ventas`,
  estado: `${SUPABASE_CONFIG.baseUrl}/estado`,
  stock: `${SUPABASE_CONFIG.baseUrl}/stock`,
  temperatura: `${LOCAL_BASE_URL}/temperatura`,
  productos: `${SUPABASE_CONFIG.baseUrl}/productos`,
  control: `${SUPABASE_CONFIG.baseUrl}/control`,
} as const;
