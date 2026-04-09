import { API_CONFIG } from '@/config/api';

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
  tipo: string;
  descuento: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_validez: number;
  ubicacion: string;
  maquinas: string;
  cantidad_codigos: number;
  codigos_generados?: number;
  contenido?: any;
}

export interface CodigoCupon {
  id: string;
  codigo: string;
  estado: string;
  usado: boolean;
  fecha_expiracion: string;
  fecha_creacion: string;
}

export interface ImagenDisponible {
  url: string;
  nombre: string;
}

// === PRODUCTOS ===

export const fetchProductos = async (imei: string): Promise<ProductosResponse> => {
  const response = await fetch(`${API_CONFIG.endpoints.productos}?imei=${imei}`, { headers: API_CONFIG.headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudieron obtener los productos`);
  }
  const data = await response.json();
  const productos = (data.productos || []).map((p: any) => ({
    position: p.position,
    goodsName: p.nombre || p.goodsName || `Posición ${p.position}`,
    price: String(p.precio || p.price || '0'),
    imagePath: p.imagen || p.imagePath || '',
    stock: p.stock ?? 0,
    enable: p.activo !== undefined ? (p.activo ? 1 : 0) : (p.enable ?? 1),
  }));
  return { success: data.success !== false, productos };
};

export const updateProductoPrecio = async (imei: string, position: number, precio: string) => {
  const response = await fetch(API_CONFIG.endpoints.productos, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ imei, position, precio: Number(precio) }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar el precio');
  }
  return response.json();
};

export const updateProductoNombre = async (imei: string, position: number, nombre: string) => {
  const response = await fetch(API_CONFIG.endpoints.productos, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ imei, position, nombre }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar el nombre');
  }
  const data = await response.json();
  await new Promise(resolve => setTimeout(resolve, 3000));
  await sincronizarProductos(imei);
  return data;
};

export const updateProductoImagen = async (imei: string, position: number, imageUrl: string) => {
  const response = await fetch(API_CONFIG.endpoints.productos, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
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
  return [];
};

export const subirImagen = async (_file: File): Promise<string> => {
  throw new Error('Subida de imagen no disponible temporalmente');
};

// === SINCRONIZACIÓN ===

export const sincronizarProductos = async (imei: string) => {
  const response = await fetch(API_CONFIG.endpoints.control, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ imei, comando: 'sincronizar_productos' }),
  });
  if (!response.ok) {
    console.error('Error sincronizando productos');
  }
  return response.json();
};

export const sincronizarMedios = async (imei: string) => {
  const response = await fetch(API_CONFIG.endpoints.control, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ imei, comando: 'sincronizar_medios' }),
  });
  if (!response.ok) {
    console.error('Error sincronizando medios');
  }
  return response.json();
};

// === CUPONES ===

export const fetchCupones = async (page: number = 1): Promise<{ cupones: CuponDescuento[]; total: number; pagina_actual: number; total_paginas: number }> => {
  const response = await fetch(
    `${API_CONFIG.endpoints.cupones}?action=list&page=${page}`,
    { headers: API_CONFIG.headers }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener cupones');
  }
  const data = await response.json();
  const rawList: any[] = Array.isArray(data.cupones) ? data.cupones : [];
  const cupones = rawList.map((c: any) => ({
    id: String(c.id ?? c.couponId ?? ''),
    nombre: c.nombre ?? c.couponName ?? '',
    tipo: c.tipo ?? 'descuento',
    descuento: String(c.contenido?.money ?? c.descuento ?? '0'),
    fecha_inicio: c.fecha_inicio ?? c.startTime ?? '',
    fecha_fin: c.fecha_fin ?? c.endTime ?? '',
    dias_validez: Number(c.dias_validez ?? c.validDay ?? 0),
    ubicacion: c.ubicacion ?? c.localName ?? '',
    maquinas: c.maquinas ?? '',
    cantidad_codigos: Number(c.cantidad_codigos ?? c.codeNum ?? 0),
    codigos_generados: Number(c.codigos_generados ?? c.codeNum ?? 0),
    contenido: c.contenido ?? {},
  }));
  return {
    cupones,
    total: data.total || cupones.length,
    pagina_actual: data.pagina_actual || page,
    total_paginas: data.total_paginas || 1,
  };
};

export const crearCupon = async (data: {
  couponType: string;
  totalCount: string;
  couponName: string;
  startTime: string;
  endTime: string;
  validDay: string;
  deviceImeis: string;
  localName: string;
  content: string;
}) => {
  const response = await fetch(`${API_CONFIG.endpoints.cupones}?action=edit`, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({
      couponId: '0',
      ...data,
    }),
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok || responseData?.success === false) {
    throw new Error(responseData?.error || `Error al crear cupón`);
  }
  return responseData;
};

export const fetchCodigosCupon = async (cuponId: string, page: number = 1): Promise<{ codigos: CodigoCupon[]; total: number; cupon?: any }> => {
  const response = await fetch(
    `${API_CONFIG.endpoints.cupones}?action=records&couponId=${cuponId}&page=${page}`,
    { headers: API_CONFIG.headers }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener códigos');
  }
  const data = await response.json();
  const rawCodigos = Array.isArray(data.codigos) ? data.codigos : [];
  const codigos = rawCodigos.map((item: any) => ({
    id: String(item.id ?? item.couponRecordId ?? item.code ?? crypto.randomUUID()),
    codigo: String(item.codigo ?? item.code ?? ''),
    estado: item.estado ?? (Number(item.status ?? 0) === 0 ? 'disponible' : 'usado'),
    usado: item.estado === 'usado' || Number(item.status ?? 0) !== 0,
    fecha_expiracion: String(item.fecha_expiracion ?? item.expireTime ?? ''),
    fecha_creacion: String(item.fecha_creacion ?? item.createTime ?? ''),
  }));
  return {
    codigos,
    total: data.total || codigos.length,
    cupon: data.cupon,
  };
};

export const generarCodigosCupon = async (cuponId: string, cantidad: number) => {
  const response = await fetch(`${API_CONFIG.endpoints.cupones}?action=generate`, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ couponId: cuponId, num: String(cantidad) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'Error al generar códigos');
  }
  return data;
};

export const eliminarCupon = async (cuponIds: string[]) => {
  const response = await fetch(
    `${API_CONFIG.endpoints.cupones}?action=delete&couponIds=${cuponIds.join(',')}`,
    {
      method: 'DELETE',
      headers: API_CONFIG.headers,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'No se pudo eliminar el cupón');
  }
  return data;
};

export const eliminarCodigoCupon = async (recordIds: string[]) => {
  const response = await fetch(
    `${API_CONFIG.endpoints.cupones}?action=delete_code&couponRecordIds=${recordIds.join('#')}`,
    {
      method: 'DELETE',
      headers: API_CONFIG.headers,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'No se pudo eliminar el código');
  }
  return data;
};

// === CONTROL REMOTO ===

const sendControlCommand = async (imei: string, comando: string) => {
  const response = await fetch(API_CONFIG.endpoints.control, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
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
  const response = await fetch(API_CONFIG.endpoints.stock, {
    method: 'POST',
    headers: API_CONFIG.postHeaders,
    body: JSON.stringify({ imei, posiciones, llenar_completo: true }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al actualizar stock');
  }
  return response.json();
};

export const actualizarStockConSync = async (imei: string, position: string | number, cantidad: number): Promise<{ success: boolean; sync_status?: string; warning?: string; message?: string }> => {
  const positionStr = String(position);
  const cantidadNum = Number(cantidad);

  if (!Number.isFinite(cantidadNum)) {
    return { success: false, sync_status: 'failed', message: 'Cantidad inválida' };
  }

  try {
    const response = await fetch(API_CONFIG.endpoints.stock, {
      method: 'POST',
      headers: API_CONFIG.postHeaders,
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
