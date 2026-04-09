import { API_HEADERS, API_POST_HEADERS, API_ENDPOINTS, LOCAL_API_HEADERS, LOCAL_API_ENDPOINTS } from '@/lib/api-config';

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
  const response = await fetch(`${LOCAL_API_ENDPOINTS.productos}?imei=${imei}`, { headers: LOCAL_API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudieron obtener los productos`);
  }
  const data = await response.json();
  return { success: data.success, productos: data.productos || [] };
};

export const updateProductoPrecio = async (imei: string, position: number, precio: string) => {
  const response = await fetch(API_ENDPOINTS.productos, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, position, precio: Number(precio) }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar el precio');
  }
  return response.json();
};

export const updateProductoNombre = async (imei: string, position: number, nombre: string) => {
  const response = await fetch(API_ENDPOINTS.productos, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, position, nombre }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar el nombre');
  }
  const data = await response.json();
  // Wait 3 seconds then sync products
  await new Promise(resolve => setTimeout(resolve, 3000));
  await sincronizarProductos(imei);
  return data;
};

export const updateProductoImagen = async (imei: string, position: number, imageUrl: string) => {
  const response = await fetch(API_ENDPOINTS.productos, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, position, imagen: imageUrl }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar la imagen');
  }
  const data = await response.json();
  await sincronizarMedios(imei);
  return data;
};

export const fetchImagenesDisponibles = async (): Promise<ImagenDisponible[]> => {
  // This endpoint may not be available yet via edge functions
  // Return empty for now
  return [];
};

export const subirImagen = async (_file: File): Promise<string> => {
  // Image upload will need to be handled via storage
  throw new Error('Subida de imagen no disponible temporalmente');
};

// === SINCRONIZACIÓN ===

export const sincronizarProductos = async (imei: string) => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, comando: 'sincronizar_productos' }),
  });
  if (!response.ok) {
    console.error('Error sincronizando productos');
  }
  return response.json();
};

export const sincronizarMedios = async (imei: string) => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, comando: 'sincronizar_medios' }),
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
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei: data.imei, comando: 'crear_cupon', datos: data }),
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok || responseData?.success === false) {
    throw new Error(`Error al crear cupón. Respuesta: ${JSON.stringify(responseData)}`);
  }
  return responseData;
};

export const fetchCupones = async (imei: string): Promise<CuponDescuento[]> => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, comando: 'listar_cupones' }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener cupones');
  }
  const data = await response.json();
  const rawList: any[] = Array.isArray(data.cupones) ? data.cupones : [];
  return rawList.map((c: any) => ({
    id: String(c.couponId ?? c.id ?? ''),
    nombre: c.couponName ?? c.nombre ?? '',
    descuento: String(c.descuento ?? '0'),
    fecha_inicio: c.startTime ?? c.fecha_inicio ?? '',
    fecha_fin: c.endTime ?? c.fecha_fin ?? '',
    dias_validez: Number(c.validDay ?? c.dias_validez ?? 0),
    ubicacion: c.localName ?? c.ubicacion ?? '',
    cantidad_codigos: Number(c.codeNum ?? c.cantidad_codigos ?? 0),
    codigos_generados: Number(c.codeNum ?? c.codigos_generados ?? 0),
  }));
};

export const fetchCodigosCupon = async (cuponId: string): Promise<CodigoCupon[]> => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ comando: 'listar_codigos_cupon', cupon_id: cuponId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener códigos');
  }
  const data = await response.json();
  const rawCodigos = Array.isArray(data?.codigos) ? data.codigos : [];
  return rawCodigos.map((item: any) => ({
    id: String(item.couponRecordId ?? item.id ?? item.code ?? crypto.randomUUID()),
    codigo: String(item.code ?? item.codigo ?? ''),
    usado: Number(item.status ?? item.usado ?? 0) !== 0,
    fecha_expiracion: String(item.expireTime ?? item.fecha_expiracion ?? ''),
  }));
};

export const eliminarCupon = async (cuponId: string) => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ comando: 'eliminar_cupon', cupon_id: cuponId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(`No se pudo eliminar el cupón: ${JSON.stringify(data)}`);
  }
  return data;
};

// === CONTROL REMOTO ===

const sendControlCommand = async (imei: string, comando: string) => {
  const response = await fetch(API_ENDPOINTS.control, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, comando }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error al ejecutar comando: ${comando}`);
  }
  return response.json();
};

export const controlOrigen = async (imei: string) => sendControlCommand(imei, 'origen');
export const controlDeshielo = async (imei: string) => sendControlCommand(imei, 'deshielo_abrir');
export const controlDescongelacionOn = async (imei: string) => sendControlCommand(imei, 'deshielo_abrir');
export const controlDescongelacionOff = async (imei: string) => sendControlCommand(imei, 'deshielo_cerrar');
export const controlPausarVentas = async (imei: string) => sendControlCommand(imei, 'pausar_ventas');
export const controlReanudarVentas = async (imei: string) => sendControlCommand(imei, 'reanudar_ventas');
export const controlHacerHelado = async (imei: string) => sendControlCommand(imei, 'hacer_helado');
export const controlRefrigeracionOn = async (imei: string) => sendControlCommand(imei, 'refrigeracion_abrir');
export const controlRefrigeracionOff = async (imei: string) => sendControlCommand(imei, 'refrigeracion_cerrar');
export const controlLimpieza = async (imei: string) => sendControlCommand(imei, 'limpieza');

// === REPOSICIÓN DE STOCK ===

export const actualizarStockTopping = async (imei: string, posiciones: string[]) => {
  const response = await fetch(API_ENDPOINTS.stock, {
    method: 'POST',
    headers: API_POST_HEADERS,
    body: JSON.stringify({ imei, posiciones, llenar_completo: true }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar stock');
  }
  return response.json();
};

// Actualizar stock con sincronización a máquina física
export const actualizarStockConSync = async (imei: string, position: string | number, cantidad: number): Promise<{ success: boolean; sync_status?: string; warning?: string; message?: string }> => {
  const positionStr = String(position);
  const cantidadNum = Number(cantidad);

  if (!Number.isFinite(cantidadNum)) {
    return { success: false, sync_status: 'failed', message: 'Cantidad inválida' };
  }

  try {
    const response = await fetch(API_ENDPOINTS.stock, {
      method: 'POST',
      headers: API_POST_HEADERS,
      body: JSON.stringify({ imei, position: positionStr, cantidad: cantidadNum }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, sync_status: 'failed', message: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      success: data.success === true,
      sync_status: data.sync_status || 'success',
      warning: data.warning,
      message: data.message,
    };
  } catch (error) {
    return { success: false, sync_status: 'failed', message: (error as Error).message };
  }
};
