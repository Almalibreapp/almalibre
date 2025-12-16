import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Play, Clock, Loader2, GraduationCap, X } from 'lucide-react';

interface Tutorial {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duracion: string | null;
}

const categories = [
  { value: 'all', label: 'Todos', icon: '📚' },
  { value: 'inicio', label: 'Inicio', icon: '🚀' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: '🔧' },
  { value: 'toppings', label: 'Toppings', icon: '🍫' },
  { value: 'limpieza', label: 'Limpieza', icon: '✨' },
  { value: 'problemas', label: 'Problemas', icon: '⚠️' },
];

const categoryColors: Record<string, string> = {
  inicio: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  mantenimiento: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  toppings: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  limpieza: 'bg-green-500/10 text-green-600 border-green-500/20',
  problemas: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export const Tutorials = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);

  useEffect(() => {
    fetchTutorials();
  }, []);

  const fetchTutorials = async () => {
    try {
      const { data, error } = await supabase
        .from('video_tutoriales')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (error) throw error;
      setTutorials(data || []);
    } catch (error) {
      console.error('Error fetching tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTutorials = tutorials.filter(
    (tutorial) => activeCategory === 'all' || tutorial.categoria === activeCategory
  );

  // Group tutorials by category
  const groupedTutorials = filteredTutorials.reduce((acc, tutorial) => {
    const cat = tutorial.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tutorial);
    return acc;
  }, {} as Record<string, Tutorial[]>);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Tutoriales</h1>
              <p className="text-sm text-muted-foreground">Aprende a usar tu máquina</p>
            </div>
          </div>
          
          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={activeCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat.value)}
                className="flex-shrink-0 gap-1.5"
              >
                <span>{cat.icon}</span>
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {selectedVideo.video_url ? (
                  <iframe
                    src={selectedVideo.video_url}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <p className="text-muted-foreground">Video no disponible</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={() => setSelectedVideo(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3 mb-2">
                <Badge className={categoryColors[selectedVideo.categoria] || 'bg-muted'}>
                  {selectedVideo.categoria}
                </Badge>
                {selectedVideo.duracion && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {selectedVideo.duracion}
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2">{selectedVideo.titulo}</h3>
              <p className="text-muted-foreground">{selectedVideo.descripcion}</p>
            </div>
          </div>
        </div>
      )}

      <main className="container px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTutorials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Sin tutoriales</h2>
              <p className="text-muted-foreground text-center">
                No hay tutoriales disponibles en esta categoría
              </p>
            </CardContent>
          </Card>
        ) : activeCategory === 'all' ? (
          // Grouped view when showing all
          <div className="space-y-8">
            {Object.entries(groupedTutorials).map(([category, items]) => {
              const categoryInfo = categories.find(c => c.value === category);
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">{categoryInfo?.icon}</span>
                    <h2 className="font-semibold text-lg capitalize">{category}</h2>
                    <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {items.map((tutorial) => (
                      <TutorialCard
                        key={tutorial.id}
                        tutorial={tutorial}
                        onClick={() => setSelectedVideo(tutorial)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Grid view when filtering
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredTutorials.map((tutorial) => (
              <TutorialCard
                key={tutorial.id}
                tutorial={tutorial}
                onClick={() => setSelectedVideo(tutorial)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

interface TutorialCardProps {
  tutorial: Tutorial;
  onClick: () => void;
}

const TutorialCard = ({ tutorial, onClick }: TutorialCardProps) => (
  <Card
    className="cursor-pointer hover:shadow-md transition-all duration-200 animate-fade-in overflow-hidden group"
    onClick={onClick}
  >
    <div className="relative aspect-video bg-muted">
      {tutorial.thumbnail_url ? (
        <img
          src={tutorial.thumbnail_url}
          alt={tutorial.titulo}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
          <Play className="h-12 w-12 text-primary/50" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg">
          <Play className="h-6 w-6 text-primary-foreground ml-1" />
        </div>
      </div>
      {tutorial.duracion && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {tutorial.duracion}
        </div>
      )}
    </div>
    <CardContent className="p-4">
      <Badge 
        variant="outline" 
        className={`mb-2 text-xs ${categoryColors[tutorial.categoria] || ''}`}
      >
        {tutorial.categoria}
      </Badge>
      <h3 className="font-medium line-clamp-2 mb-1">{tutorial.titulo}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {tutorial.descripcion}
      </p>
    </CardContent>
  </Card>
);
