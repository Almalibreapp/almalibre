import { cn } from '@/lib/utils';

/**
 * Renderiza markdown muy básico: texto entre asteriscos simples (*texto*)
 * se convierte en <strong>. El resto se muestra tal cual.
 */
export function MarkdownTexto({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  if (!children) return null;

  const parts = children.split(/(\*[^*]+\*)/g);

  return (
    <span className={cn('inline', className)}>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
