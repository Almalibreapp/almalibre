import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAcademyStatus } from '@/hooks/useAcademyStatus';
import { supabase } from '@/integrations/supabase/client';
import { LockedVideoPlayer } from '@/components/academy/LockedVideoPlayer';
import { GraduationCap, CheckCircle2, Lock, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

const CONSENT_TEXT =
  'Confirmo que he completado con éxito todos los vídeos a nivel operativo de la máquina y que, dado a esto, declaro estar apto/a para operar la máquina. Entiendo que lo aquí explicado es como debe ser la buena praxis de la máquina y me comprometo a aplicarlo en mi operativa diaria como franquiciado/a de Almalibre.';

export const Academy = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useAcademyStatus();

  const [activeIdx, setActiveIdx] = useState(0);
  const [signing, setSigning] = useState(false);
  const [firmaNombre, setFirmaNombre] = useState(profile?.nombre || '');
  const [acepta, setAcepta] = useState(false);

  useEffect(() => {
    if (profile?.nombre && !firmaNombre) setFirmaNombre(profile.nombre);
  }, [profile?.nombre]);

  const modulos = data?.modulos || [];
  const progreso = data?.progreso || [];
  const certified = data?.certified;
  const allCompleted = data?.allCompleted;

  const progresoMap = new Map(progreso.map((p) => [p.modulo_id, p]));
  const completedCount = progreso.filter((p) => p.completado).length;
  const totalCount = modulos.length;
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const isUnlocked = (idx: number) => {
    if (idx === 0) return true;
    const prev = modulos[idx - 1];
    return progresoMap.get(prev.id)?.completado === true;
  };

  const handleProgress = async (moduloId: string, segundos: number) => {
    if (!user) return;
    await supabase.from('academy_progreso').upsert(
      { user_id: user.id, modulo_id: moduloId, segundos_vistos: segundos },
      { onConflict: 'user_id,modulo_id' }
    );
  };

  const handleCompleted = async (moduloId: string) => {
    if (!user) return;
    await supabase.from('academy_progreso').upsert(
      {
        user_id: user.id,
        modulo_id: moduloId,
        completado: true,
        completado_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,modulo_id' }
    );
    toast({ title: '✓ Módulo completado', description: 'Puedes continuar con el siguiente.' });
    await refetch();
  };

  const handleFirmar = async () => {
    if (!user) return;
    if (!firmaNombre.trim()) {
      toast({ title: 'Falta tu nombre', description: 'Debes escribir tu nombre completo.', variant: 'destructive' });
      return;
    }
    if (!acepta) {
      toast({ title: 'Debes aceptar', description: 'Marca la casilla de aceptación.', variant: 'destructive' });
      return;
    }
    setSigning(true);
    const { error } = await supabase.from('academy_consentimiento').insert({
      user_id: user.id,
      firma_nombre: firmaNombre.trim(),
      texto_consentimiento: CONSENT_TEXT,
    });
    setSigning(false);
    if (error) {
      toast({ title: 'Error al firmar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '🎓 ¡Formación completada!', description: 'Ya puedes operar tu máquina.' });
    qc.invalidateQueries({ queryKey: ['academy-status'] });
    setTimeout(() => navigate('/', { state: { skipRoleSelect: true } }), 800);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!modulos.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Almalibre Academy</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-3">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Aún no hay módulos de formación disponibles. El equipo de Almalibre los publicará pronto.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const activeModulo = modulos[activeIdx];
  const activeProgreso = progresoMap.get(activeModulo.id);

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold flex items-center gap-2">
              Almalibre Academy
              {certified && <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Certificado</Badge>}
            </h1>
            <p className="text-xs text-muted-foreground">Formación operativa obligatoria</p>
          </div>
        </div>
        <div className="container px-4 pb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">{completedCount} / {totalCount} módulos</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6 max-w-4xl">
        {/* Lista de módulos */}
        <div className="grid gap-2">
          {modulos.map((m, idx) => {
            const p = progresoMap.get(m.id);
            const unlocked = isUnlocked(idx);
            const isActive = idx === activeIdx;
            return (
              <button
                key={m.id}
                disabled={!unlocked}
                onClick={() => unlocked && setActiveIdx(idx)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                } ${!unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  p?.completado ? 'bg-emerald-500 text-white' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {p?.completado ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{m.titulo}</p>
                  {m.descripcion && <p className="text-xs text-muted-foreground truncate">{m.descripcion}</p>}
                </div>
                {!unlocked && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Player del módulo activo */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{activeModulo.titulo}</CardTitle>
                {activeModulo.descripcion && (
                  <CardDescription className="mt-1">{activeModulo.descripcion}</CardDescription>
                )}
              </div>
              <Badge variant="outline">Módulo {activeIdx + 1}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <LockedVideoPlayer
              key={activeModulo.id}
              src={activeModulo.video_url}
              title={activeModulo.titulo}
              initialSecondsWatched={activeProgreso?.segundos_vistos || 0}
              alreadyCompleted={activeProgreso?.completado || false}
              onProgress={(s) => handleProgress(activeModulo.id, s)}
              onCompleted={() => handleCompleted(activeModulo.id)}
            />
            {activeProgreso?.completado && activeIdx < modulos.length - 1 && (
              <Button className="w-full mt-4" onClick={() => setActiveIdx(activeIdx + 1)}>
                Siguiente módulo →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Consentimiento */}
        {allCompleted && !certified && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle>Consentimiento final</CardTitle>
              </div>
              <CardDescription>
                Has completado todos los módulos. Firma el consentimiento para certificarte y comenzar a operar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background rounded-lg border text-sm leading-relaxed">
                {CONSENT_TEXT}
              </div>
              <div className="space-y-2">
                <Label htmlFor="firma">Tu nombre completo</Label>
                <Input
                  id="firma"
                  value={firmaNombre}
                  onChange={(e) => setFirmaNombre(e.target.value)}
                  placeholder="Nombre y apellidos"
                  maxLength={120}
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="acepta" checked={acepta} onCheckedChange={(v) => setAcepta(!!v)} />
                <Label htmlFor="acepta" className="text-sm font-normal leading-snug cursor-pointer">
                  He leído y acepto el consentimiento. Mi firma equivale a aceptación electrónica.
                </Label>
              </div>
              <Button className="w-full" size="lg" onClick={handleFirmar} disabled={signing}>
                <Sparkles className="h-4 w-4 mr-2" />
                {signing ? 'Firmando...' : 'Firmar y certificarme'}
              </Button>
            </CardContent>
          </Card>
        )}

        {certified && data?.consent && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-700">Estás certificado</p>
                <p className="text-sm text-muted-foreground">
                  Consentimiento firmado el {new Date((data.consent as any).aceptado_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};
