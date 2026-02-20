import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache structure
let cachedProducts: any[] = [];
let cachedAppCategoryId: number | null = null;
let productsCacheTimestamp = 0;
let categoryCacheTimestamp = 0;

const PRODUCTS_CACHE_MS = 15 * 60 * 1000; // 15 minutes
const CATEGORY_CACHE_MS = 60 * 60 * 1000; // 1 hour (category IDs rarely change)

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

// Resolve the WooCommerce category ID for the slug "app"
async function resolveAppCategoryId(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<number | null> {
  const now = Date.now();
  if (cachedAppCategoryId && (now - categoryCacheTimestamp) < CATEGORY_CACHE_MS) {
    console.log(`Using cached app category ID: ${cachedAppCategoryId}`);
    return cachedAppCategoryId;
  }

  const params = new URLSearchParams({
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    slug: 'app',
    per_page: '5',
  });

  try {
    const response = await fetchWithRetry(
      `${baseUrl}/wp-json/wc/v3/products/categories?${params}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) {
      console.warn('Failed to fetch categories:', response.status);
      return null;
    }
    const categories = await response.json();
    const appCat = categories.find((c: any) => c.slug === 'app');
    if (appCat) {
      cachedAppCategoryId = appCat.id;
      categoryCacheTimestamp = now;
      console.log(`Resolved app category ID: ${appCat.id}`);
      return appCat.id;
    }
    console.warn('Category "app" not found, returning all products');
    return null;
  } catch (err) {
    console.warn('Error fetching categories:', err);
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .trim()
    .substring(0, 200);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const baseUrl = 'https://www.almalibreacaihouse.com';
    const now = Date.now();

    // --- Serve from cache if fresh ---
    if (cachedProducts.length > 0 && (now - productsCacheTimestamp) < PRODUCTS_CACHE_MS) {
      console.log(`Returning ${cachedProducts.length} cached products`);
      return new Response(JSON.stringify({
        products: cachedProducts,
        total: cachedProducts.length,
        cached: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Resolve the "app" category ID ---
    const appCategoryId = await resolveAppCategoryId(baseUrl, consumerKey, consumerSecret);

    // --- Fetch products filtered by "app" category ---
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      per_page: '100',
      page: '1',
      status: 'publish',
      orderby: 'menu_order',
      order: 'asc',
    });

    if (appCategoryId) {
      params.append('category', String(appCategoryId));
    }

    console.log(`Fetching products from WooCommerce (category: ${appCategoryId ?? 'all'})...`);

    let response: Response;
    try {
      response = await fetchWithRetry(
        `${baseUrl}/wp-json/wc/v3/products?${params}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      // Stale cache fallback
      if (cachedProducts.length > 0) {
        console.log('Returning stale cache due to fetch error');
        return new Response(JSON.stringify({
          products: cachedProducts,
          total: cachedProducts.length,
          cached: true,
          stale: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw fetchError;
    }

    if (!response.ok) {
      if (cachedProducts.length > 0) {
        console.log('Returning stale cache due to API error');
        return new Response(JSON.stringify({
          products: cachedProducts,
          total: cachedProducts.length,
          cached: true,
          stale: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const raw = await response.json();

    const transformed = raw
      .filter((p: any) => p.in_stock !== false)  // Only in-stock products
      .map((product: any) => ({
        id: product.id.toString(),
        nombre: product.name,
        descripcion: stripHtml(product.short_description || product.description || ''),
        precio: parseFloat(product.price) || 0,
        categoria: product.categories?.[0]?.name || 'general',
        categoria_id: product.categories?.[0]?.id || null,
        imagen_url: product.images?.[0]?.src || null,
        stock_disponible: product.stock_quantity ?? null,
        en_stock: product.in_stock ?? true,
        sku: product.sku || null,
      }));

    // Update cache
    cachedProducts = transformed;
    productsCacheTimestamp = now;
    console.log(`Cached ${transformed.length} products (filtered to "app" category)`);

    return new Response(JSON.stringify({
      products: transformed,
      total: transformed.length,
      cached: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error fetching WooCommerce products:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
