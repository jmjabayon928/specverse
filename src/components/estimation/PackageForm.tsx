'use client';

import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { EstimationPackage } from '@/types/estimation';

export type PackageFormProps = {
  defaultValues?: EstimationPackage;
  mode?: 'create' | 'edit';
  onSubmitSuccess?: () => void;
};

type PackageFormData = {
  EstimationID: number;
  PackageName: string;
  Description?: string;
};

export default function PackageForm({
  defaultValues,
  mode = 'create',
  onSubmitSuccess,
}: PackageFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PackageFormData>({
    defaultValues: {
      EstimationID: defaultValues?.EstimationID ?? undefined,
      PackageName: defaultValues?.PackageName ?? '',
      Description: defaultValues?.Description ?? '',
    },
  });

  const onSubmit = async (data: PackageFormData) => {
    try {
      const response = await fetch(
        mode === 'edit'
          ? `/api/estimation/packages/${defaultValues?.PackageID}`
          : `/api/estimation/packages/create`,
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) throw new Error('Save failed');

      if (onSubmitSuccess) onSubmitSuccess();
      else router.push(`/estimation/${data.EstimationID}`);
    } catch (err) {
      console.error(err);
      alert('Failed to save package.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Estimation ID (hidden for edit mode) */}
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
          {errors.EstimationID && (
            <p className="text-red-500 text-sm">Estimation ID is required.</p>
          )}
        </div>
      )}

      {/* Package Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Package Name</label>
        <input
          type="text"
          {...register('PackageName', { required: true })}
          className="input"
        />
        {errors.PackageName && (
          <p className="text-red-500 text-sm">Package name is required.</p>
        )}
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
          {mode === 'edit' ? 'Update Package' : 'Create Package'}
        </button>
      </div>
    </form>
  );
}
