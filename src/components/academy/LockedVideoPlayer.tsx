import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Lock, CheckCircle2 } from 'lucide-react';

interface LockedVideoPlayerProps {
  src: string;
  title: string;
  initialSecondsWatched?: number;
  alreadyCompleted?: boolean;
  onProgress: (secondsWatched: number, duration: number) => void;
  onCompleted: () => void;
}

/**
 * Reproductor obligatorio: prohibe adelantar más allá del máximo visto,
 * exige llegar al 99% para marcar como completado.
 */
export const LockedVideoPlayer = ({
  src,
  title,
  initialSecondsWatched = 0,
  alreadyCompleted = false,
  onProgress,
  onCompleted,
}: LockedVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef<number>(alreadyCompleted ? Infinity : initialSecondsWatched);
  const lastReportRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(alreadyCompleted);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleLoaded = () => {
      setDuration(v.duration || 0);
      if (initialSecondsWatched > 0 && initialSecondsWatched < v.duration) {
        v.currentTime = initialSecondsWatched;
      }
    };

    const handleTimeUpdate = () => {
      const t = v.currentTime;
      setCurrentTime(t);

      // Bloquear seek hacia adelante
      if (!alreadyCompleted && t > maxWatchedRef.current + 1.5) {
        v.currentTime = maxWatchedRef.current;
        return;
      }
      if (t > maxWatchedRef.current) {
        maxWatchedRef.current = t;
      }

      // Reportar progreso cada 5s
      if (t - lastReportRef.current >= 5) {
        lastReportRef.current = t;
        onProgress(Math.floor(maxWatchedRef.current), Math.floor(v.duration || 0));
      }

      // 99% = completado
      if (!completed && v.duration > 0 && t / v.duration >= 0.99) {
        setCompleted(true);
        onCompleted();
      }
    };

    const handleEnded = () => {
      setPlaying(false);
      if (!completed) {
        setCompleted(true);
        onCompleted();
      }
    };

    const handleSeeking = () => {
      if (alreadyCompleted) return;
      if (v.currentTime > maxWatchedRef.current + 1.5) {
        v.currentTime = maxWatchedRef.current;
      }
    };

    v.addEventListener('loadedmetadata', handleLoaded);
    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('seeking', handleSeeking);
    v.addEventListener('play', () => setPlaying(true));
    v.addEventListener('pause', () => setPlaying(false));

    return () => {
      v.removeEventListener('loadedmetadata', handleLoaded);
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('seeking', handleSeeking);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const watchedPct = duration > 0 && !alreadyCompleted ? (maxWatchedRef.current / duration) * 100 : 100;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full"
          playsInline
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
        />
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
            aria-label="Reproducir"
          >
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-xl">
              <Play className="h-8 w-8 text-primary-foreground ml-1" />
            </div>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium truncate">{title}</span>
          {completed ? (
            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
              <CheckCircle2 className="h-4 w-4" /> Completado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              <Lock className="h-3.5 w-3.5" /> No adelantes
            </span>
          )}
        </div>

        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-muted-foreground/30" style={{ width: `${watchedPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {playing ? 'Pausar' : 'Reproducir'}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
