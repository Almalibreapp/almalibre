import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache
let cachedProducts: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

    // Parse query params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '12');
    const category = url.searchParams.get('category');

    // For first page, check cache
    const cacheKey = `${page}-${perPage}-${category || 'all'}`;
    const now = Date.now();
    
    if (page === 1 && cachedProducts && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      console.log('Returning cached products for page 1');
      return new Response(JSON.stringify({ 
        products: cachedProducts.slice(0, perPage), 
        hasMore: cachedProducts.length > perPage,
        total: cachedProducts.length,
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
    const response = await fetch(wooUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', response.status, errorText);
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
