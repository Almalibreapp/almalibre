import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', response.status, errorText);
      throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
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
