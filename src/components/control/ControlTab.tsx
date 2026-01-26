import { ProductManagement } from './ProductManagement';
import { DiscountCoupons } from './DiscountCoupons';
import { RemoteControl } from './RemoteControl';
import { Separator } from '@/components/ui/separator';

interface ControlTabProps {
  imei: string;
  ubicacion?: string;
}

export const ControlTab = ({ imei, ubicacion }: ControlTabProps) => {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Section A: Product Management */}
      <ProductManagement imei={imei} />
      
      <Separator />
      
      {/* Section B: Discount Coupons */}
      <DiscountCoupons imei={imei} ubicacion={ubicacion} />
      
      <Separator />
      
      {/* Section C: Remote Control */}
      <RemoteControl imei={imei} />
    </div>
  );
};
