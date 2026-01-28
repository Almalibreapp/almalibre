import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Parse query params for category filter
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const perPage = url.searchParams.get('per_page') || '100';

    // Build WooCommerce API URL - Using nonstopmachine.com store
    const baseUrl = 'https://nonstopmachine.com/wp-json/wc/v3/products';
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      per_page: perPage,
      status: 'publish',
    });

    if (category && category !== 'all') {
      params.append('category', category);
    }

    const wooUrl = `${baseUrl}?${params.toString()}`;
    
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

    // Transform products to match our interface
    const transformedProducts = products.map((product: any) => ({
      id: product.id.toString(),
      nombre: product.name,
      descripcion: product.short_description || product.description || null,
      precio: parseFloat(product.price) || 0,
      categoria: product.categories?.[0]?.name || 'general',
      categoria_id: product.categories?.[0]?.id || null,
      imagen_url: product.images?.[0]?.src || null,
      stock_disponible: product.stock_quantity || null,
      en_stock: product.in_stock ?? true,
      sku: product.sku || null,
    }));

    return new Response(JSON.stringify({ products: transformedProducts }), {
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
