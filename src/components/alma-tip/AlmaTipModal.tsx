import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';
import { API_CONFIG } from '@/config/api';
import almaAvatarImg from '@/assets/alma-avatar.png';

const FALLBACK_MESSAGES: Record<string, string> = {
  motivacion: '¡Hoy es un gran día para vender! 💪',
  neutral: '¡Bienvenido de vuelta! Revisa tus ventas del día.',
};

function getTodayKey() {
  const d = new Date();
  return `alma_tip_shown_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AlmaTipModalProps {
  imei: string | undefined;
}

export function AlmaTipModal({ imei }: AlmaTipModalProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [categoria, setCategoria] = useState<string>('neutral');
  const [avatarError, setAvatarError] = useState(false);

  const todayKey = getTodayKey();

  useEffect(() => {
    if (!imei) return;
    if (localStorage.getItem(todayKey)) return;

    const timer = setTimeout(async () => {
      let msg = FALLBACK_MESSAGES.neutral;
      let cat = 'neutral';

      try {
        const res = await fetch(
          `https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1/alma-tip?imei=${imei}`,
          { headers: API_CONFIG.headers },
        );
        if (res.ok) {
          const data = await res.json();
          msg = data.mensaje || msg;
          cat = data.categoria || cat;
        }
      } catch {
        // silently fallback
      }

      setMessage(msg);
      setCategoria(cat);
      setOpen(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [imei, todayKey]);

  const handleClose = useCallback(() => {
    setOpen(false);
    localStorage.setItem(todayKey, Date.now().toString());
  }, [todayKey]);

  if (!message) return null;

  const categoryColor: Record<string, string> = {
    exito: 'text-green-600',
    motivacion: 'text-amber-600',
    producto: 'text-blue-600',
    neutral: 'text-primary',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        {/* Header band */}
        <div className="bg-[#86EFAC]/30 px-6 pt-6 pb-4 flex flex-col items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            {!avatarError ? (
              <img
                src={ALMA_AVATAR_URL}
                alt="Alma"
                className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-lg"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-[#86EFAC] flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </span>
          </div>

          <DialogHeader className="text-center space-y-0.5">
            <DialogTitle className="text-lg font-semibold">Alma Tip</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tu Asistente Almalibre
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className={`text-center text-sm leading-relaxed ${categoryColor[categoria] || 'text-foreground'}`}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-center">
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded-full bg-[#86EFAC] hover:bg-[#6de69a] text-sm font-medium text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#86EFAC] focus:ring-offset-2"
          >
            ¡Entendido!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
