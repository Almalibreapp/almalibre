import { useState, useEffect, useCallback } from 'react';
import { API_POST_HEADERS, API_ENDPOINTS } from '@/lib/api-config';

export interface EmailConfig {
  id: number;
  imei: string;
  email: string;
  activo: number;
  created_at: string;
}

export function useEmailNotifications() {
  const [configuraciones, setConfiguraciones] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfiguraciones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_ENDPOINTS.control}`, {
        method: 'POST',
        headers: API_POST_HEADERS,
        body: JSON.stringify({ comando: 'listar_emails' }),
      });
      const data = await response.json();
      if (data.success) {
        setConfiguraciones(data.configuraciones || []);
      } else {
        throw new Error(data.message || 'Error al cargar configuraciones');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  const addConfig = async (imei: string, email: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.control, {
        method: 'POST',
        headers: API_POST_HEADERS,
        body: JSON.stringify({ comando: 'agregar_email', imei, email }),
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data.message || 'Error al agregar';
        if (msg.toLowerCase().includes('ya existe') || msg.toLowerCase().includes('already')) {
          return { success: false, error: msg, duplicate: true };
        }
        throw new Error(msg);
      }
      await fetchConfiguraciones();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error desconocido' };
    }
  };

  const deleteConfig = async (id: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.control, {
        method: 'POST',
        headers: API_POST_HEADERS,
        body: JSON.stringify({ comando: 'eliminar_email', id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al eliminar');
      }
      await fetchConfiguraciones();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error desconocido' };
    }
  };

  useEffect(() => {
    fetchConfiguraciones();
  }, [fetchConfiguraciones]);

  return {
    configuraciones,
    loading,
    error,
    addConfig,
    deleteConfig,
    refresh: fetchConfiguraciones,
  };
}
