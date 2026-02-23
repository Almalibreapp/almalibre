const API_BASE_URL = 'https://nonstopmachine.com/wp-json';
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Types
export interface Producto {
  position: number;
  goodsName: string;
  price: string;
  imagePath: string;
  stock: number;
  enable: number;
}

export interface ProductosResponse {
  success: boolean;
  productos: Producto[];
}

export interface CuponDescuento {
  id: string;
  nombre: string;
  descuento: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_validez: number;
  ubicacion: string;
  cantidad_codigos: number;
  codigos_generados?: number;
}

export interface CodigoCupon {
  id: string;
  codigo: string;
  usado: boolean;
  fecha_expiracion: string;
}

export interface ImagenDisponible {
  url: string;
  nombre: string;
}

// === PRODUCTOS ===

export const fetchProductos = async (imei: string): Promise<ProductosResponse> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/productos/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudieron obtener los productos`);
  }

  return response.json();
};

export const updateProductoPrecio = async (imei: string, position: number, precio: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/producto/precio`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imei,
      position: position.toString(),
      precio,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar el precio');
  }

  return response.json();
};

export const updateProductoNombre = async (imei: string, position: number, nombre: string) => {
  console.log('=== DEBUG CAMBIO NOMBRE ===');
  console.log('IMEI:', imei);
  console.log('Position:', position);
  console.log('Nuevo nombre:', nombre);

  const response = await fetch(`${API_BASE_URL}/fabricante/v1/producto/nombre`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imei,
      position: position.toString(),
      nombre,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar el nombre');
  }

  const data = await response.json();
  console.log('Respuesta:', JSON.stringify(data, null, 2));

  // Wait 3 seconds then sync products
  await new Promise(resolve => setTimeout(resolve, 3000));
  await sincronizarProductos(imei);

  return data;
};

export const updateProductoImagen = async (imei: string, position: number, imageUrl: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/producto/imagen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imei,
      position: position.toString(),
      image_url: imageUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar la imagen');
  }

  const data = await response.json();

  // Immediately sync media
  await sincronizarMedios(imei);

  return data;
};

export const fetchImagenesDisponibles = async (): Promise<ImagenDisponible[]> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/imagenes-disponibles`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener imágenes');
  }

  const data = await response.json();
  return data.imagenes || data || [];
};

export const subirImagen = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('imagen', file);

  const response = await fetch(`${API_BASE_URL}/fabricante/v1/subir-imagen`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al subir la imagen');
  }

  const data = await response.json();
  return data.url || data.image_url;
};

// === SINCRONIZACIÓN ===

export const sincronizarProductos = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/sincronizar-productos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    console.error('Error sincronizando productos');
  }

  return response.json();
};

export const sincronizarMedios = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/sincronizar-medios`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    console.error('Error sincronizando medios');
  }

  return response.json();
};

// === CUPONES ===

export const crearCupon = async (data: {
  imei: string;
  nombre: string;
  descuento: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_validez: string;
  ubicacion: string;
  cantidad_codigos: number;
}) => {
  const body = {
    imei: data.imei,
    nombre: data.nombre,
    fecha_inicio: data.fecha_inicio,
    fecha_fin: data.fecha_fin,
    dias_validez: data.dias_validez,
    ubicacion: data.ubicacion,
    cantidad_codigos: data.cantidad_codigos,
    descuento: data.descuento,
  };

  console.log('=== CREAR CUPÓN - DEBUG ===');
  console.log('IMEI:', data.imei);
  console.log('Body completo:', JSON.stringify(body, null, 2));
  console.log('Fecha inicio formato:', body.fecha_inicio);
  console.log('Fecha fin formato:', body.fecha_fin);
  console.log('Tipo dias_validez:', typeof body.dias_validez);
  console.log('Tipo cantidad_codigos:', typeof body.cantidad_codigos);
  console.log('Tipo descuento:', typeof body.descuento);
  console.log('========================');

  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupon/crear`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const responseData = await response.json().catch(() => ({}));

  console.log('=== RESPUESTA DEL SERVIDOR ===');
  console.log('Status:', response.status);
  console.log('Data completa:', JSON.stringify(responseData, null, 2));
  console.log('============================');

  const isConfirmedSuccess =
    response.status === 200 &&
    responseData?.success === true;

  if (!isConfirmedSuccess) {
    throw new Error(`Error al crear cupón. Respuesta: ${JSON.stringify(responseData)}`);
  }

  return responseData;
};

export const fetchCupones = async (imei: string): Promise<CuponDescuento[]> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupones/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener cupones');
  }

  const data = await response.json();
  console.log('[fetchCupones] Raw API response:', JSON.stringify(data));
  
  // API returns { cupones: { list: [...] } } with fields like couponId, couponName, etc.
  let rawList: any[] = [];
  if (data.cupones && Array.isArray(data.cupones.list)) {
    rawList = data.cupones.list;
  } else if (Array.isArray(data.cupones)) {
    rawList = data.cupones;
  }

  if (rawList.length > 0) {
    console.log('[fetchCupones] First raw coupon keys:', Object.keys(rawList[0]));
    console.log('[fetchCupones] First raw coupon:', JSON.stringify(rawList[0]));
  }

  // Map API fields to our interface
  return rawList.map((c: any) => {
    const content = typeof c.content === 'string' ? JSON.parse(c.content) : (c.content || {});
    return {
      id: String(c.couponId ?? c.id ?? ''),
      nombre: c.couponName ?? c.nombre ?? '',
      descuento: content.money ?? c.descuento ?? '0',
      fecha_inicio: c.startTime ?? c.fecha_inicio ?? '',
      fecha_fin: c.endTime ?? c.fecha_fin ?? '',
      dias_validez: c.validDay ?? c.dias_validez ?? 0,
      ubicacion: c.localName ?? c.ubicacion ?? '',
      cantidad_codigos: c.codeNum ?? c.cantidad_codigos ?? 0,
      codigos_generados: c.codigos_generados ?? 0,
    };
  });
};

export const fetchCodigosCupon = async (cuponId: string): Promise<CodigoCupon[]> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupon/codigos/${cuponId}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener códigos');
  }

  const data = await response.json();

  // Normaliza respuesta para evitar crashes (a veces viene anidado)
  // Posibles formas:
  // - { codigos: [...] }
  // - { codigos: { list: [...] } }
  // - { list: [...] }
  // - [...]
  if (Array.isArray(data?.codigos)) return data.codigos;
  if (data?.codigos && Array.isArray(data.codigos.list)) return data.codigos.list;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data)) return data;
  return [];
};

// === CONTROL REMOTO ===

export const controlOrigen = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/origen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al reiniciar máquina');
  }

  return response.json();
};

export const controlDeshielo = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/deshielo`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al activar deshielo');
  }

  return response.json();
};

export const controlPausarVentas = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/pausar-ventas`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al pausar ventas');
  }

  return response.json();
};

export const controlReanudarVentas = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/reanudar-ventas`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al reanudar ventas');
  }

  return response.json();
};

export const controlHacerHelado = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/hacer-helado`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al fabricar helado de prueba');
  }

  return response.json();
};

export const controlRefrigeracionOn = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/refrigeracion/on`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al activar refrigeración');
  }

  return response.json();
};

export const controlRefrigeracionOff = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/control/refrigeracion/off`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imei }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al desactivar refrigeración');
  }

  return response.json();
};

// === REPOSICIÓN DE STOCK ===

export const actualizarStockTopping = async (imei: string, posiciones: string[]) => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/stock/reponer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      imei,
      posiciones,
      llenar_completo: true 
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar stock');
  }

  return response.json();
};
