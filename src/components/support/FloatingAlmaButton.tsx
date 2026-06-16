import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const WHATSAPP_NUMBER = "19016750678"; // sin "+" para wa.me
const DEFAULT_MESSAGE = "Hola Alma, necesito ayuda con mi máquina";

// Rutas donde NO mostramos el botón (auth, checkout)
const HIDDEN_PREFIXES = ["/checkout"];

export const FloatingAlmaButton = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRole(user?.id);

  // Solo visible para franquiciados autenticados (no admins, no invitados)
  if (!user || isAdmin || loading) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear con Alma por WhatsApp"
      className="fixed z-[45] right-4 bottom-24 md:bottom-8 md:right-8 flex items-center justify-center w-14 h-14 md:w-auto md:h-auto md:px-5 md:py-3.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 alma-float"
      style={{ 
        marginBottom: "max(env(safe-area-inset-bottom), 0px)",
        animation: "alma-pulse 3s ease-in-out infinite"
      }}
    >
      <MessageCircle className="h-6 w-6 md:h-5 md:w-5 md:mr-2" strokeWidth={2} />
      <span className="font-semibold text-sm hidden md:inline">Hablar con Alma</span>
      {/* Online indicator dot - mobile only */}
      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-background md:hidden" />
    </a>
  );
}