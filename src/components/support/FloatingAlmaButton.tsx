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
      className="fixed z-[45] right-3 bottom-20 md:bottom-8 md:right-8 flex items-center justify-center w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95 animate-in fade-in zoom-in duration-500"
      style={{ 
        marginBottom: "max(env(safe-area-inset-bottom), 0px)",
        animation: "alma-pulse 3s ease-in-out infinite"
      }}
    >
      <MessageCircle className="h-5 w-5 md:mr-2" />
      <span className="font-medium text-sm hidden md:inline">Alma</span>
      {/* Mobile indicator dot */}
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background md:hidden animate-pulse" />
    </a>
  );
};