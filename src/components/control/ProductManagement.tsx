import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { 
  fetchProductos, 
  updateProductoPrecio, 
  updateProductoNombre, 
  updateProductoImagen,
  fetchImagenesDisponibles,
  subirImagen,
  Producto 
} from '@/services/controlApi';
import { Pencil, Loader2, Image, Euro, Type, Upload, Link, Check } from 'lucide-react';

interface ProductManagementProps {
  imei: string;
}

export const ProductManagement = ({ imei }: ProductManagementProps) => {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['productos', imei],
    queryFn: () => fetchProductos(imei),
    enabled: !!imei,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-warning/50 bg-warning-light">
        <CardContent className="py-6 text-center">
          <p className="text-warning">Error al cargar productos: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  const productos = data?.productos || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Gestión de Productos</h3>
      
      {productos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay productos configurados
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {productos.map((producto) => (
            <Card key={producto.position} className="overflow-hidden">
              <div className="aspect-square relative bg-muted">
                {producto.imagePath ? (
                  <img 
                    src={producto.imagePath} 
                    alt={producto.goodsName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-background/90 px-2 py-1 rounded text-xs font-medium">
                  #{producto.position}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium truncate">{producto.goodsName}</p>
                <p className="text-primary font-bold">{producto.price}€</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => {
                    setSelectedProduct(producto);
                    setIsEditOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Producto #{selectedProduct?.position}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <ProductEditTabs 
              producto={selectedProduct} 
              imei={imei}
              onSuccess={() => {
                setIsEditOpen(false);
                queryClient.invalidateQueries({ queryKey: ['productos', imei] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface ProductEditTabsProps {
  producto: Producto;
  imei: string;
  onSuccess: () => void;
}

const ProductEditTabs = ({ producto, imei, onSuccess }: ProductEditTabsProps) => {
  const [precio, setPrecio] = useState(producto.price);
  const [nombre, setNombre] = useState(producto.goodsName);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const priceMutation = useMutation({
    mutationFn: () => updateProductoPrecio(imei, producto.position, precio),
    onSuccess: () => {
      toast({ title: '✅ Precio actualizado' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const nameMutation = useMutation({
    mutationFn: () => updateProductoNombre(imei, producto.position, nombre),
    onSuccess: () => {
      toast({ title: '✅ Nombre actualizado' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const imageMutation = useMutation({
    mutationFn: (url: string) => updateProductoImagen(imei, producto.position, url),
    onSuccess: () => {
      toast({ title: '✅ Imagen actualizada' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const url = await subirImagen(uploadFile);
      return updateProductoImagen(imei, producto.position, url);
    },
    onSuccess: () => {
      toast({ title: '✅ Imagen subida y actualizada' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Tabs defaultValue="precio" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="precio" className="text-xs">
          <Euro className="h-3 w-3 mr-1" />
          Precio
        </TabsTrigger>
        <TabsTrigger value="nombre" className="text-xs">
          <Type className="h-3 w-3 mr-1" />
          Nombre
        </TabsTrigger>
        <TabsTrigger value="imagen" className="text-xs">
          <Image className="h-3 w-3 mr-1" />
          Imagen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="precio" className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label>Nuevo Precio (€)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0.00"
            />
            <span className="flex items-center text-xl">€</span>
          </div>
        </div>
        <Button 
          className="w-full"
          onClick={() => priceMutation.mutate()}
          disabled={priceMutation.isPending}
        >
          {priceMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Guardar Precio
        </Button>
      </TabsContent>

      <TabsContent value="nombre" className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label>Nuevo Nombre</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
          />
        </div>
        <Button 
          className="w-full"
          onClick={() => nameMutation.mutate()}
          disabled={nameMutation.isPending}
        >
          {nameMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Guardar Nombre
        </Button>
        {nameMutation.isPending && (
          <p className="text-xs text-muted-foreground text-center">
            Sincronizando con la máquina...
          </p>
        )}
      </TabsContent>

      <TabsContent value="imagen" className="space-y-4 mt-4">
        <ImageTabs 
          imei={imei}
          position={producto.position}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          imageMutation={imageMutation}
          uploadMutation={uploadMutation}
        />
      </TabsContent>
    </Tabs>
  );
};

interface ImageTabsProps {
  imei: string;
  position: number;
  imageUrl: string;
  setImageUrl: (url: string) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  imageMutation: any;
  uploadMutation: any;
}

const ImageTabs = ({ 
  imei, 
  position, 
  imageUrl, 
  setImageUrl, 
  uploadFile, 
  setUploadFile,
  imageMutation,
  uploadMutation 
}: ImageTabsProps) => {
  const { data: imagenes, isLoading } = useQuery({
    queryKey: ['imagenes-disponibles'],
    queryFn: fetchImagenesDisponibles,
  });

  return (
    <Tabs defaultValue="galeria" className="w-full">
      <TabsList className="grid w-full grid-cols-3 text-xs">
        <TabsTrigger value="galeria">Galería</TabsTrigger>
        <TabsTrigger value="subir">Subir</TabsTrigger>
        <TabsTrigger value="url">URL</TabsTrigger>
      </TabsList>

      <TabsContent value="galeria" className="mt-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {(imagenes || []).map((img, idx) => (
              <button
                key={idx}
                className="aspect-square rounded border-2 border-transparent hover:border-primary overflow-hidden"
                onClick={() => imageMutation.mutate(img.url)}
                disabled={imageMutation.isPending}
              >
                <img src={img.url} alt={img.nombre} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="subir" className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>Seleccionar imagen</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
        </div>
        <Button 
          className="w-full"
          onClick={() => uploadMutation.mutate()}
          disabled={!uploadFile || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Subir y Aplicar
        </Button>
      </TabsContent>

      <TabsContent value="url" className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>URL de imagen</Label>
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <Button 
          className="w-full"
          onClick={() => imageMutation.mutate(imageUrl)}
          disabled={!imageUrl || imageMutation.isPending}
        >
          {imageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Link className="h-4 w-4 mr-2" />
          )}
          Aplicar URL
        </Button>
      </TabsContent>
    </Tabs>
  );
};
