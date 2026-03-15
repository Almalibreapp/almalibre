import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'https://nonstopmachine.com/wp-json/fabricante-ext/v1';
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

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
      const response = await fetch(`${API_BASE_URL}/config/emails`, { headers });
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
      const response = await fetch(`${API_BASE_URL}/config/emails`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imei, email }),
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
      const response = await fetch(`${API_BASE_URL}/config/emails/${id}`, {
        method: 'DELETE',
        headers,
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
