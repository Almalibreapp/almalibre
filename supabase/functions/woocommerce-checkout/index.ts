import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, max = 300) {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Retry POST with exponential backoff for transient upstream failures (5xx / timeouts)
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, 20000);

      // Retry on transient upstream errors
      if (response.status >= 500 && attempt < maxRetries - 1) {
        const peek = await response.clone().text().catch(() => '');
        console.log(`Attempt ${attempt + 1} failed with ${response.status}. ${truncate(stripHtml(peek), 120)}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }

      return response;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      const isAbort = error.name === 'AbortError';
      console.log(`Attempt ${attempt + 1} failed (${isAbort ? 'timeout' : 'error'}):`, error.message);

      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

interface CartItem {
  product_id: string;
  quantity: number;
  name: string;
  price: number;
}

interface CheckoutRequest {
  items: CartItem[];
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    postcode: string;
    country: string;
  };
  shipping?: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
    postcode: string;
    country: string;
  };
  customer_note?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not configured');
    }

    const body: CheckoutRequest = await req.json();
    
    if (!body.items || body.items.length === 0) {
      throw new Error('No items in cart');
    }

    if (!body.billing || !body.billing.email) {
      throw new Error('Billing information required');
    }

    // Build line items for WooCommerce
    const lineItems = body.items.map((item) => ({
      product_id: parseInt(item.product_id),
      quantity: item.quantity,
    }));

    // Create order in WooCommerce
    const orderData = {
      payment_method: 'bacs', // Bank transfer - will be updated when customer pays
      payment_method_title: 'Pago pendiente',
      set_paid: false,
      status: 'pending',
      billing: {
        first_name: body.billing.first_name || '',
        last_name: body.billing.last_name || '',
        address_1: body.billing.address_1 || '',
        city: body.billing.city || '',
        postcode: body.billing.postcode || '',
        country: body.billing.country || 'ES',
        email: body.billing.email,
        phone: body.billing.phone || '',
      },
      shipping: body.shipping || {
        first_name: body.billing.first_name || '',
        last_name: body.billing.last_name || '',
        address_1: body.billing.address_1 || '',
        city: body.billing.city || '',
        postcode: body.billing.postcode || '',
        country: body.billing.country || 'ES',
      },
      line_items: lineItems,
      customer_note: body.customer_note || '',
    };

    console.log('Creating WooCommerce order:', JSON.stringify(orderData, null, 2));

    const baseUrl = 'https://www.almalibreacaihouse.com/wp-json/wc/v3/orders';
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    });

    let response: Response;
    try {
      response = await fetchWithRetry(`${baseUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      }, 3);
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to reach WooCommerce';
      console.error('WooCommerce request failed after retries:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'El servidor de pago está tardando en responder. Intenta de nuevo en unos segundos.',
          retryable: true,
          upstream_error: truncate(message, 200),
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      const cleaned = truncate(stripHtml(errorText), 400);
      console.error('WooCommerce API error:', response.status, cleaned);

      const isRetryable = response.status >= 500 || response.status === 429;
      const status = isRetryable ? 503 : 400;
      const friendly = isRetryable
        ? 'El servidor de pago no está disponible temporalmente. Intenta de nuevo en unos segundos.'
        : 'No se pudo crear el pedido. Revisa tus datos e inténtalo de nuevo.';

      return new Response(
        JSON.stringify({
          error: friendly,
          retryable: isRetryable,
          upstream_status: response.status,
          upstream_message: cleaned,
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order = await response.json();
    console.log('Order created:', order.id, order.order_key);

    // Generate payment URL - WooCommerce checkout page
    const paymentUrl = `https://www.almalibreacaihouse.com/checkout/order-pay/${order.id}/?pay_for_order=true&key=${order.order_key}`;

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.number,
      order_key: order.order_key,
      total: order.total,
      currency: order.currency,
      status: order.status,
      payment_url: paymentUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error creating WooCommerce order:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
