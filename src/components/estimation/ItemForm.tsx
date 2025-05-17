'use client';

import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { EstimationItem } from '@/types/estimation';

export type ItemFormProps = {
  defaultValues?: EstimationItem;
  mode?: 'create' | 'edit';
  onSubmitSuccess?: () => void;
};

type ItemFormData = {
  EstimationID: number;
  PackageID?: number;
  ItemID: number; // SheetID
  Quantity: number;
  Description?: string;
};

export default function ItemForm({
  defaultValues,
  mode = 'create',
  onSubmitSuccess,
}: ItemFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormData>({
    defaultValues: {
      EstimationID: defaultValues?.EstimationID ?? undefined,
      PackageID: defaultValues?.PackageID ?? undefined,
      ItemID: defaultValues?.ItemID ?? undefined,
      Quantity: defaultValues?.Quantity ?? 1,
      Description: defaultValues?.Description ?? '',
    },
  });

  const onSubmit = async (data: ItemFormData) => {
    try {
      const res = await fetch(
        mode === 'edit'
          ? `/api/estimation/items/${defaultValues?.EItemID}`
          : `/api/estimation/items/create`,
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) throw new Error('Save failed');

      if (onSubmitSuccess) onSubmitSuccess();
      else router.push(`/estimation/packages/${data.PackageID}`);
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('Failed to save item.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Estimation ID (hidden for edit) */}
      {mode === 'edit' ? (
        <input type="hidden" value={defaultValues?.EstimationID} {...register('EstimationID')} />
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Estimation ID</label>
          <input
            type="number"
            {...register('EstimationID', { required: true })}
            className="input"
          />
          {errors.EstimationID && <p className="text-red-500 text-sm">Required.</p>}
        </div>
      )}

      {/* Package ID (hidden or optional) */}
      <input type="hidden" value={defaultValues?.PackageID ?? ''} {...register('PackageID')} />

      {/* ItemID = Datasheet ID */}
      <div>
        <label className="block text-sm font-medium mb-1">Item (Datasheet)</label>
        <input
          type="number"
          {...register('ItemID', { required: true })}
          className="input"
        />
        {errors.ItemID && <p className="text-red-500 text-sm">ItemID is required.</p>}
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium mb-1">Quantity</label>
        <input
          type="number"
          step="0.01"
          {...register('Quantity', { required: true, min: 0 })}
          className="input"
        />
        {errors.Quantity && <p className="text-red-500 text-sm">Quantity is required.</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          {...register('Description')}
          className="input"
          rows={3}
        />
      </div>

      {/* Submit */}
      <div>
        <button type="submit" className="btn-primary">
          {mode === 'edit' ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}
