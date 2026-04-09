const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
