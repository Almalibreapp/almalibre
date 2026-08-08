import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Camera, Loader2, UserCog } from 'lucide-react';
import type { Profile } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  userId?: string;
  onSaved: (p: Partial<Profile>) => void;
}

/** Editor del perfil con el que el administrador firma sus intervenciones en el chat */
export const PerfilSoporteDialog = ({ open, onOpenChange, profile, userId, onSaved }: Props) => {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cargo, setCargo] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(profile?.nombre ?? '');
    setApellidos(profile?.apellidos ?? '');
    setCargo(profile?.cargo ?? '');
    setFotoUrl(profile?.foto_url ?? null);
  }, [open, profile]);

  const subirFoto = async (file: File) => {
    if (!userId) return;
    setSubiendo(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (!data?.signedUrl) throw new Error('sin url');
      setFotoUrl(data.signedUrl);
    } catch {
      toast({ title: 'No se pudo subir la foto', variant: 'destructive' });
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    if (!userId) return;
    setGuardando(true);
    const updates = {
      nombre: nombre.trim(),
      apellidos: apellidos.trim() || null,
      cargo: cargo.trim() || null,
      foto_url: fotoUrl,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    setGuardando(false);
    if (error) {
      toast({ title: 'No se pudo guardar el perfil', variant: 'destructive' });
      return;
    }
    onSaved(updates as Partial<Profile>);
    toast({ title: 'Perfil de soporte actualizado' });
    onOpenChange(false);
  };

  const iniciales = `${nombre?.[0] ?? ''}${apellidos?.[0] ?? ''}`.toUpperCase() || 'A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4 text-primary" />
            Mi perfil de soporte
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              {fotoUrl && <AvatarImage src={fotoUrl} alt="Foto de perfil" />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{iniciales}</AvatarFallback>
            </Avatar>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
              >
                {subiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                Cambiar foto
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1">JPG o PNG, máx. 2 MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subirFoto(f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Belén" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input
              id="apellidos"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="García"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Soporte Almalibre"
            />
          </div>

          <Button className="w-full rounded-xl" onClick={guardar} disabled={guardando || !nombre.trim()}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar perfil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
