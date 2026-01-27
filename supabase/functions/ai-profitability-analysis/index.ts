import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE_URL = 'https://nonstopmachine.com/wp-json/helados/v1';
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE';

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

    console.log('Fetching data for machines:', macAddresses);

    // Fetch real sales and stock data for all machines using correct endpoints
    let allSalesData: any[] = [];
    let allToppingsData: any[] = [];
    let totalVentasHoy = 0;
    let totalVentasAyer = 0;
    let totalVentasMes = 0;
    
    for (const mac of macAddresses) {
      if (!mac) continue;
      
      try {
        // Fetch sales summary (ventas-resumen) - CORRECT ENDPOINT
        const salesSummaryResponse = await fetch(
          `${API_BASE_URL}/ventas-resumen/${mac}`,
          {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (salesSummaryResponse.ok) {
          const salesSummary = await salesSummaryResponse.json();
          console.log(`Sales summary for ${mac}:`, salesSummary);
          
          totalVentasHoy += salesSummary.ventas_hoy?.total_euros || 0;
          totalVentasAyer += salesSummary.ventas_ayer?.total_euros || 0;
          totalVentasMes += salesSummary.ventas_mes?.total_euros || 0;
          
          allSalesData.push({
            mac_addr: mac,
            ventas_hoy: salesSummary.ventas_hoy,
            ventas_ayer: salesSummary.ventas_ayer,
            ventas_mes: salesSummary.ventas_mes
          });
        }

        // Fetch detailed sales (ventas-detalle) for today - CORRECT ENDPOINT
        const salesDetailResponse = await fetch(
          `${API_BASE_URL}/ventas-detalle/${mac}`,
          {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (salesDetailResponse.ok) {
          const salesDetail = await salesDetailResponse.json();
          console.log(`Sales detail for ${mac}: ${salesDetail.total_ventas} sales`);
          
          if (salesDetail.ventas && salesDetail.ventas.length > 0) {
            allSalesData.push({
              mac_addr: mac,
              fecha: salesDetail.fecha,
              ventas_detalle: salesDetail.ventas
            });
          }
        }

        // Fetch toppings stock - CORRECT ENDPOINT
        const toppingsResponse = await fetch(
          `${API_BASE_URL}/toppings/${mac}`,
          {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (toppingsResponse.ok) {
          const toppingsData = await toppingsResponse.json();
          console.log(`Toppings for ${mac}: ${toppingsData.total_toppings} toppings`);
          
          if (toppingsData.toppings && toppingsData.toppings.length > 0) {
            allToppingsData.push({
              mac_addr: mac,
              toppings: toppingsData.toppings
            });
          }
        }

        // Fetch topping statistics - CORRECT ENDPOINT
        const statsResponse = await fetch(
          `${API_BASE_URL}/estadisticas-toppings/${mac}`,
          {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          console.log(`Topping stats for ${mac}:`, statsData);
          
          if (statsData.estadisticas) {
            allToppingsData.push({
              mac_addr: mac,
              estadisticas: statsData.estadisticas
            });
          }
        }
      } catch (apiError) {
        console.error(`Error fetching from WordPress API for ${mac}:`, apiError);
      }
    }

    // Calculate period multiplier for estimations
    let periodMultiplier = 1;
    let periodLabel = 'este mes';
    switch (periodo) {
      case 'last_month': 
        periodMultiplier = 1; 
        periodLabel = 'mes anterior';
        break;
      case 'quarter': 
        periodMultiplier = 3; 
        periodLabel = 'últimos 3 meses';
        break;
      case 'year': 
        periodMultiplier = 12; 
        periodLabel = 'este año';
        break;
      default: 
        periodMultiplier = 1;
        periodLabel = 'este mes';
    }

    const prompt = `Eres un experto analista financiero para negocios de helados/açaí.

DATOS REALES DE VENTAS (del sistema de las máquinas):
- Ventas de hoy: ${totalVentasHoy.toFixed(2)}€
- Ventas de ayer: ${totalVentasAyer.toFixed(2)}€
- Ventas del mes actual: ${totalVentasMes.toFixed(2)}€

Período seleccionado: ${periodLabel}
${periodo === 'month' ? `Ingresos totales del período: ${totalVentasMes.toFixed(2)}€` : ''}
${periodo === 'last_month' ? `Estimación mes anterior basada en ayer: ${(totalVentasAyer * 30).toFixed(2)}€` : ''}
${periodo === 'quarter' ? `Estimación 3 meses: ${(totalVentasMes * 3).toFixed(2)}€` : ''}
${periodo === 'year' ? `Estimación anual: ${(totalVentasMes * 12).toFixed(2)}€` : ''}

Detalle de ventas del día:
${JSON.stringify(allSalesData.filter(s => s.ventas_detalle), null, 2)}

Stock y datos de toppings:
${JSON.stringify(allToppingsData, null, 2)}

Precios de referencia de toppings (costo aproximado por kg):
- Oreo: 8€
- M&M/Lacasitos: 9€
- Filipinos: 7€
- Fresa: 6€
- Kinder: 10€
- Chocolate blanco: 8€
- Granola: 8€
- Miel: 6€

IMPORTANTE: Usa los datos REALES de ventas proporcionados arriba para calcular la rentabilidad.
El margen de beneficio típico en este negocio es del 60-70% sobre el precio de venta.

Analiza la rentabilidad y genera insights accionables. Devuelve un JSON con este formato exacto:
{
  "profitability": {
    "ingresosTotales": ${periodo === 'month' ? totalVentasMes.toFixed(2) : periodo === 'quarter' ? (totalVentasMes * 3).toFixed(2) : periodo === 'year' ? (totalVentasMes * 12).toFixed(2) : (totalVentasAyer * 30).toFixed(2)},
    "costoProductos": (calcula basado en ~35% de los ingresos),
    "beneficioBruto": (ingresos - costos),
    "margenBeneficio": (porcentaje de margen),
    "comparativaMesAnterior": (estima comparación basada en tendencia hoy vs ayer)
  },
  "insights": [
    {
      "tipo": "topping_rentable",
      "titulo": "Título del insight basado en datos reales",
      "detalle": "Explicación con números concretos de las ventas reales",
      "accion": "Qué hacer al respecto",
      "accionDirecta": "crear_codigo" 
    }
  ],
  "toppingData": [
    {
      "nombre": "Nombre del topping",
      "ventas": (estimación basada en uso),
      "costo": (costo estimado),
      "margen": (porcentaje de margen),
      "porcentajeUso": (basado en estadísticas reales),
      "destacado": true/false,
      "alerta": true/false (si stock bajo o poco uso)
    }
  ],
  "projection": {
    "min": (proyección conservadora próximo mes),
    "max": (proyección optimista),
    "potential": (si aplica mejoras sugeridas)
  }
}

Genera 3-4 insights relevantes basados en los DATOS REALES de ventas. Responde SOLO con el JSON, sin markdown ni explicaciones.`;

    console.log('Sending prompt to AI with real sales data');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Eres un analista financiero experto en negocios de comida. Siempre respondes en JSON válido con análisis detallados y accionables basados en datos reales.' },
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
      console.log('AI analysis result:', result);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, cleanContent);
      // Fallback with real data
      result = { 
        profitability: {
          ingresosTotales: totalVentasMes,
          costoProductos: totalVentasMes * 0.35,
          beneficioBruto: totalVentasMes * 0.65,
          margenBeneficio: 65,
          comparativaMesAnterior: totalVentasHoy > totalVentasAyer ? 5 : -5
        },
        insights: [{
          tipo: 'ventas',
          titulo: 'Análisis basado en ventas reales',
          detalle: `Este mes llevas ${totalVentasMes.toFixed(2)}€ en ventas. Hoy: ${totalVentasHoy.toFixed(2)}€, Ayer: ${totalVentasAyer.toFixed(2)}€`,
          accion: 'Revisa los toppings más vendidos para optimizar stock'
        }], 
        toppingData: [],
        projection: {
          min: totalVentasMes * 0.9,
          max: totalVentasMes * 1.1,
          potential: totalVentasMes * 1.2
        }
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