import { ProductManagement } from './ProductManagement';
import { RemoteControl } from './RemoteControl';
import { Separator } from '@/components/ui/separator';

interface ControlTabProps {
  imei: string;
  ubicacion?: string;
  readOnly?: boolean;
}

export const ControlTab = ({ imei, ubicacion, readOnly = false }: ControlTabProps) => {
  return (
    <div className="space-y-8 animate-fade-in">
      {!readOnly && (
        <>
          <ProductManagement imei={imei} />
          <Separator />
        </>
      )}
      
      <RemoteControl imei={imei} />
    </div>
  );
};
