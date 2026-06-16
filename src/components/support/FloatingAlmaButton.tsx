import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "19016750678"; // sin "+" para wa.me
const DEFAULT_MESSAGE = "Hola Alma, necesito ayuda con mi máquina";

// Rutas donde NO mostramos el botón (admin, auth, checkout)
const HIDDEN_PREFIXES = ["/admin", "/checkout"];

export const FloatingAlmaButton = () => {
  const { pathname } = useLocation();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear con Alma por WhatsApp"
      className="fixed z-50 right-4 bottom-24 md:bottom-6 flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white shadow-lg shadow-emerald-500/30 px-4 py-3 transition-transform active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <MessageCircle className="h-5 w-5" />
      <span className="font-semibold text-sm hidden sm:inline">Hablar con Alma</span>
    </a>
  );
};
