'use client';

import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { PackageFormProps, PackageFormValues } from '@/types/estimation';

export default function PackageForm({
  defaultValues,
  estimationId,
  mode = 'create',
  onSuccess,
  onCancel,
}: PackageFormProps & { onCancel?: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PackageFormValues>({
    defaultValues: {
      PackageName: defaultValues?.PackageName || '',
      Description: defaultValues?.Description || '',
      Sequence: defaultValues?.Sequence ?? 1,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      reset({
        PackageName: defaultValues.PackageName,
        Description: defaultValues.Description ?? '',
        Sequence: defaultValues.Sequence ?? 1,
      });
    }
  }, [defaultValues, reset]);

  const onSubmit = async (data: PackageFormValues) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const url =
        mode === 'edit'
          ? `${baseUrl}/api/backend/estimation/packages/${defaultValues?.PackageID}`
          : `${baseUrl}/api/backend/estimation/packages/create`;

      const res = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          EstimationID: estimationId,
        }),
      });

      if (!res.ok) throw new Error('Save failed');

      onSuccess();
      if (mode === 'create') reset();
    } catch (err) {
      console.error('Package form error:', err);
      alert('Failed to save package.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
      {/* Row 1: Package Name + Sequence */}
      <div className="flex gap-4">
        <div className="w-1/2">
          <label className="block font-medium mb-1">Package Name</label>
          <input
            type="text"
            {...register('PackageName', { required: true })}
            className="input w-full"
          />
          {errors.PackageName && (
            <p className="text-red-500 text-xs mt-1">Package name is required</p>
          )}
        </div>
        <div className="w-1/2">
          <label className="block font-medium mb-1">Sequence</label>
          <input
            type="number"
            {...register('Sequence', { required: true, min: 1 })}
            className="input w-full"
          />
        </div>
      </div>

      {/* Row 2: Description */}
      <div>
        <label className="block font-medium mb-1">Description</label>
        <textarea {...register('Description')} className="input w-full" rows={3} />
      </div>

      {/* Row 3: Buttons */}
      <div className="flex justify-between">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
        >
          {mode === 'edit' ? 'Update Package' : 'Add Package'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
