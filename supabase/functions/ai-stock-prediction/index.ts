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
    const { maquinaId, macAddress } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch real stock data from WordPress API
    let stockData = [];
    let salesData = [];
    
    try {
      const stockResponse = await fetch(
        `https://nonstopmachine.com/wp-json/helados/v1/stock?imei=${macAddress}`,
        {
          headers: {
            'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
          }
        }
      );
      if (stockResponse.ok) {
        stockData = await stockResponse.json();
      }

      const salesResponse = await fetch(
        `https://nonstopmachine.com/wp-json/helados/v1/ventas?imei=${macAddress}&dias=30`,
        {
          headers: {
            'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
          }
        }
      );
      if (salesResponse.ok) {
        salesData = await salesResponse.json();
      }
    } catch (apiError) {
      console.error('Error fetching from WordPress API:', apiError);
    }

    const prompt = `Eres un experto en gestión de inventario para máquinas de helados/açaí.

Datos de stock actual de la máquina:
${JSON.stringify(stockData, null, 2)}

Historial de ventas de los últimos 30 días:
${JSON.stringify(salesData, null, 2)}

Analiza estos datos y genera predicciones de stock para cada topping. Devuelve un JSON con este formato exacto:
{
  "predictions": [
    {
      "topping": "Nombre del topping",
      "porcentaje": 75,
      "consumoPromedio": 3.5,
      "diasRestantes": 10,
      "fechaAgotamiento": "27 Dic",
      "urgencia": "normal|pronto|urgente|critico",
      "recomendacion": "Texto de recomendación"
    }
  ],
  "suggestedOrder": [
    {
      "topping": "Nombre",
      "cantidad": "1kg",
      "precio": 12.50,
      "urgencia": "URGENTE o dias restantes"
    }
  ]
}

Criterios de urgencia:
- critico: menos de 2 días
- urgente: 2-5 días  
- pronto: 5-10 días
- normal: más de 10 días

Si no hay datos suficientes, devuelve arrays vacíos. Responde SOLO con el JSON, sin markdown ni explicaciones.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Eres un asistente experto en análisis de inventario y predicción de demanda. Siempre respondes en JSON válido.' },
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
    
    // Clean up potential markdown formatting
    let cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, cleanContent);
      result = { predictions: [], suggestedOrder: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-stock-prediction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      predictions: [],
      suggestedOrder: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
