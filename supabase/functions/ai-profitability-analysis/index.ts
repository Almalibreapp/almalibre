import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { maquinaIds, macAddresses, periodo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Determine date range based on period
    const now = new Date();
    let dias = 30;
    switch (periodo) {
      case 'last_month': dias = 60; break;
      case 'quarter': dias = 90; break;
      case 'year': dias = 365; break;
      default: dias = 30;
    }

    // Fetch sales data for all machines
    let allSalesData: any[] = [];
    let allStockData: any[] = [];
    
    for (const mac of macAddresses) {
      if (!mac) continue;
      
      try {
        const salesResponse = await fetch(
          `https://nonstopmachine.com/wp-json/helados/v1/ventas?imei=${mac}&dias=${dias}`,
          {
            headers: {
              'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
            }
          }
        );
        if (salesResponse.ok) {
          const data = await salesResponse.json();
          allSalesData = allSalesData.concat(data);
        }

        const stockResponse = await fetch(
          `https://nonstopmachine.com/wp-json/helados/v1/stock?imei=${mac}`,
          {
            headers: {
              'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
            }
          }
        );
        if (stockResponse.ok) {
          const data = await stockResponse.json();
          allStockData = allStockData.concat(data);
        }
      } catch (apiError) {
        console.error('Error fetching from WordPress API:', apiError);
      }
    }

    const prompt = `Eres un experto analista financiero para negocios de helados/açaí.

Datos de ventas del período (${periodo === 'month' ? 'este mes' : periodo === 'last_month' ? 'mes anterior' : periodo === 'quarter' ? 'últimos 3 meses' : 'este año'}):
${JSON.stringify(allSalesData.slice(0, 100), null, 2)}

Datos de stock y costos estimados:
${JSON.stringify(allStockData, null, 2)}

Precios de referencia de toppings (costo aproximado por kg):
- Granola: 8€
- Chocolate: 10€
- Fresa: 9€
- Coco: 7€
- Miel: 6€
- Caramelo: 8€
- Açaí base: 12€

Analiza la rentabilidad y genera insights accionables. Devuelve un JSON con este formato exacto:
{
  "profitability": {
    "ingresosTotales": 1245.00,
    "costoProductos": 498.00,
    "beneficioBruto": 747.00,
    "margenBeneficio": 60.0,
    "comparativaMesAnterior": 12.5
  },
  "insights": [
    {
      "tipo": "topping_rentable",
      "titulo": "Tu topping más rentable es X",
      "detalle": "Explicación con números concretos",
      "accion": "Qué hacer al respecto",
      "accionDirecta": "crear_codigo" 
    }
  ],
  "toppingData": [
    {
      "nombre": "Granola",
      "ventas": 234,
      "costo": 65,
      "margen": 72,
      "porcentajeUso": 45,
      "destacado": true,
      "alerta": false
    }
  ],
  "projection": {
    "min": 750,
    "max": 850,
    "potential": 950
  }
}

Genera 3-4 insights relevantes y accionables basados en los datos reales. Si los datos son limitados, haz estimaciones razonables. Responde SOLO con el JSON, sin markdown ni explicaciones.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Eres un analista financiero experto en negocios de comida. Siempre respondes en JSON válido con análisis detallados y accionables.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';
    
    let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, cleanContent);
      result = { 
        profitability: null, 
        insights: [], 
        toppingData: [],
        projection: null 
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-profitability-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      profitability: null,
      insights: [],
      toppingData: [],
      projection: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
