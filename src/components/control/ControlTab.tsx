import { ProductManagement } from './ProductManagement';
import { DiscountCoupons } from './DiscountCoupons';
import { RemoteControl } from './RemoteControl';
import { Separator } from '@/components/ui/separator';

interface ControlTabProps {
  imei: string;
  ubicacion?: string;
  readOnly?: boolean; // When true, hides product editing (photo/price/name)
}

export const ControlTab = ({ imei, ubicacion, readOnly = false }: ControlTabProps) => {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Section A: Product Management - only show when not readOnly */}
      {!readOnly && (
        <>
          <ProductManagement imei={imei} />
          <Separator />
        </>
      )}
      
      {/* Section B: Discount Coupons */}
      <DiscountCoupons imei={imei} ubicacion={ubicacion} />
      
      <Separator />
      
      {/* Section C: Remote Control */}
      <RemoteControl imei={imei} />
    </div>
  );
};
