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
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupon/descuento`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al crear el cupón');
  }

  return response.json();
};

export const fetchCupones = async (imei: string): Promise<CuponDescuento[]> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupones/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener cupones');
  }

  const data = await response.json();
  return data.cupones || data || [];
};

export const fetchCodigosCupon = async (cuponId: string): Promise<CodigoCupon[]> => {
  const response = await fetch(`${API_BASE_URL}/fabricante/v1/cupon/codigos/${cuponId}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener códigos');
  }

  const data = await response.json();
  return data.codigos || data || [];
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
