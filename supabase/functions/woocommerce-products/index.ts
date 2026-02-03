import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache
let cachedProducts: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes (extended for resilience)

// Retry fetch with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 5xx error, retry
      if (response.status >= 500 && attempt < maxRetries - 1) {
        console.log(`Attempt ${attempt + 1} failed with ${response.status}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1} failed with error:`, lastError.message);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    // Parse params from body or query string
    let page = 1;
    let perPage = 12;
    let category: string | null = null;
    
    // Try to get params from body first (POST/GET with body)
    if (req.method === 'POST' || req.body) {
      try {
        const body = await req.json();
        page = body.page || 1;
        perPage = body.per_page || 12;
        category = body.category || null;
      } catch {
        // If body parsing fails, use query params
        const url = new URL(req.url);
        page = parseInt(url.searchParams.get('page') || '1');
        perPage = parseInt(url.searchParams.get('per_page') || '12');
        category = url.searchParams.get('category');
      }
    } else {
      const url = new URL(req.url);
      page = parseInt(url.searchParams.get('page') || '1');
      perPage = parseInt(url.searchParams.get('per_page') || '12');
      category = url.searchParams.get('category');
    }

    const now = Date.now();
    
    // Check cache first - return cached data if available
    if (cachedProducts && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      console.log('Returning cached products');
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedProducts = cachedProducts.slice(startIndex, endIndex);
      
      return new Response(JSON.stringify({ 
        products: paginatedProducts, 
        hasMore: endIndex < cachedProducts.length,
        total: cachedProducts.length,
        page,
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build WooCommerce API URL
    const baseUrl = 'https://www.almalibreacaihouse.com/wp-json/wc/v3/products';
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      per_page: '100', // Fetch all for caching
      page: '1',
      status: 'publish',
    });

    if (category && category !== 'all') {
      params.append('category', category);
    }

    const wooUrl = `${baseUrl}?${params.toString()}`;
    
    console.log('Fetching fresh products from WooCommerce...');
    
    let response: Response;
    try {
      response = await fetchWithRetry(wooUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, 3);
    } catch (fetchError) {
      // If fetch fails but we have stale cache, return it
      if (cachedProducts && cachedProducts.length > 0) {
        console.log('Returning stale cache due to fetch error');
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedProducts = cachedProducts.slice(startIndex, endIndex);
        
        return new Response(JSON.stringify({ 
          products: paginatedProducts, 
          hasMore: endIndex < cachedProducts.length,
          total: cachedProducts.length,
          page,
          cached: true,
          stale: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', response.status, errorText);
      
      // Return stale cache if available
      if (cachedProducts && cachedProducts.length > 0) {
        console.log('Returning stale cache due to API error');
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedProducts = cachedProducts.slice(startIndex, endIndex);
        
        return new Response(JSON.stringify({ 
          products: paginatedProducts, 
          hasMore: endIndex < cachedProducts.length,
          total: cachedProducts.length,
          page,
          cached: true,
          stale: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const products = await response.json();

    // Transform products
    const transformedProducts = products.map((product: any) => ({
      id: product.id.toString(),
      nombre: product.name,
      descripcion: stripHtml(product.short_description || product.description || ''),
      precio: parseFloat(product.price) || 0,
      categoria: product.categories?.[0]?.name || 'general',
      categoria_id: product.categories?.[0]?.id || null,
      imagen_url: product.images?.[0]?.src || null,
      stock_disponible: product.stock_quantity || null,
      en_stock: product.in_stock ?? true,
      sku: product.sku || null,
    }));

    // Update cache
    cachedProducts = transformedProducts;
    cacheTimestamp = now;
    console.log(`Cached ${transformedProducts.length} products`);

    // Return paginated results
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedProducts = transformedProducts.slice(startIndex, endIndex);

    return new Response(JSON.stringify({ 
      products: paginatedProducts, 
      hasMore: endIndex < transformedProducts.length,
      total: transformedProducts.length,
      page,
      cached: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching WooCommerce products:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to strip HTML tags
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .trim()
    .substring(0, 200);
}
