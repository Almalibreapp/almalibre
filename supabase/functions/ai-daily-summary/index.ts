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
    const { maquinaIds, macAddresses } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch data for all machines
    let allSalesData = [];
    let allStockData = [];
    let allTempData = [];
    const machineNames: string[] = [];
    
    for (let i = 0; i < macAddresses.length; i++) {
      const mac = macAddresses[i];
      if (!mac) continue;
      
      machineNames.push(`Máquina ${i + 1}`);
      
      try {
        // Sales from yesterday and today
        const salesResponse = await fetch(
          `https://nonstopmachine.com/wp-json/helados/v1/ventas?imei=${mac}&dias=7`,
          {
            headers: {
              'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
            }
          }
        );
        if (salesResponse.ok) {
          const data = await salesResponse.json();
          allSalesData.push({ mac, data });
        }

        // Stock data
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
          allStockData.push({ mac, data });
        }

        // Temperature data
        const tempResponse = await fetch(
          `https://nonstopmachine.com/wp-json/helados/v1/temperatura?imei=${mac}`,
          {
            headers: {
              'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE'
            }
          }
        );
        if (tempResponse.ok) {
          const data = await tempResponse.json();
          allTempData.push({ mac, data });
        }
      } catch (apiError) {
        console.error('Error fetching from WordPress API:', apiError);
      }
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const prompt = `Eres un asistente inteligente para franquiciados de máquinas de helados/açaí. Genera un resumen diario completo y motivador.

Fecha de ayer: ${yesterday.toLocaleDateString('es-ES')}
Número de máquinas: ${macAddresses.length}

Datos de ventas de la última semana:
${JSON.stringify(allSalesData, null, 2)}

Datos de stock actual por máquina:
${JSON.stringify(allStockData, null, 2)}

Datos de temperatura por máquina:
${JSON.stringify(allTempData, null, 2)}

Genera un resumen diario completo. Devuelve un JSON con este formato exacto:
{
  "fecha": "${yesterday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}",
  "metricas": {
    "ingresosTotales": 67.50,
    "ventasTotales": 12,
    "ticketPromedio": 5.62,
    "comparativaAyer": 18,
    "horaPico": "17:00 - 19:00",
    "toppingEstrella": "Granola"
  },
  "estadoMaquinas": [
    {
      "nombre": "Nombre de máquina",
      "online": true,
      "temperatura": -18.2,
      "ventasAyer": 45.00,
      "cantidadVentas": 8,
      "alertasStock": [{"nombre": "Fresa", "porcentaje": 15}]
    }
  ],
  "alertas": [
    {
      "tipo": "Stock crítico",
      "mensaje": "Fresa en 'Centro Comercial' al 15%",
      "accion": "Pedir ahora"
    }
  ],
  "insights": [
    "Ayer fue tu mejor martes del mes. 18% más ventas que el martes promedio.",
    "Esta semana vas 8% por encima del objetivo."
  ],
  "accionesSugeridas": [
    "Reponer Fresa en Centro Comercial",
    "Es miércoles: buen día para una promoción"
  ],
  "semana": [
    {"dia": "Lun", "ingresos": 42},
    {"dia": "Mar", "ingresos": 67},
    {"dia": "Mié", "ingresos": 0},
    {"dia": "Jue", "ingresos": 0},
    {"dia": "Vie", "ingresos": 0},
    {"dia": "Sáb", "ingresos": 0},
    {"dia": "Dom", "ingresos": 0}
  ],
  "metaSemana": 300,
  "totalSemana": 109
}

Sé específico con los datos reales. Si los datos son limitados, haz estimaciones razonables basadas en promedios típicos de este tipo de negocio. Los insights deben ser motivadores y accionables. Responde SOLO con el JSON, sin markdown ni explicaciones.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Eres un asistente de negocio motivador y analítico. Generas resúmenes claros, concisos y accionables. Siempre respondes en JSON válido.' },
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
      result = null;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in ai-daily-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
