import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Play, Clock, Loader2, GraduationCap } from 'lucide-react';

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
  { value: 'all', label: 'Todos' },
  { value: 'inicio', label: 'Inicio' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'toppings', label: 'Toppings' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'problemas', label: 'Problemas' },
];

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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container px-4 py-4">
          <h1 className="text-xl font-bold mb-4">Tutoriales</h1>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value} className="flex-shrink-0">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-background rounded-xl shadow-xl max-w-2xl w-full overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
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
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2">{selectedVideo.titulo}</h3>
              <p className="text-sm text-muted-foreground">{selectedVideo.descripcion}</p>
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
              <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sin tutoriales</h2>
              <p className="text-muted-foreground text-center">
                No hay tutoriales disponibles en esta categoría
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTutorials.map((tutorial) => (
              <Card
                key={tutorial.id}
                className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in overflow-hidden"
                onClick={() => setSelectedVideo(tutorial)}
              >
                <div className="flex">
                  <div className="relative w-32 h-24 bg-muted flex-shrink-0">
                    {tutorial.thumbnail_url ? (
                      <img
                        src={tutorial.thumbnail_url}
                        alt={tutorial.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm line-clamp-2">{tutorial.titulo}</h3>
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">
                        {tutorial.categoria}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {tutorial.descripcion}
                    </p>
                    {tutorial.duracion && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {tutorial.duracion}
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
