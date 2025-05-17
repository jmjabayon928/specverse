'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Estimation } from '@/types/estimation';
import { Project } from '@/types/project';

export type EstimationFormProps = {
  defaultValues?: Estimation;
  mode?: 'create' | 'edit';
  onSubmitSuccess?: () => void;
};

type EstimationFormData = {
  ProjectID: number;
  Title: string;
  Description?: string;
};

export default function EstimationForm({
  defaultValues,
  mode = 'create',
  onSubmitSuccess,
}: EstimationFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EstimationFormData>({
    defaultValues: {
      ProjectID: defaultValues?.ProjectID ?? undefined,
      Title: defaultValues?.Title ?? '',
      Description: defaultValues?.Description ?? '',
    },
  });

  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    };
    fetchProjects();
  }, []);

  const onSubmit = async (data: EstimationFormData) => {
    try {
      const res = await fetch(
        mode === 'edit'
          ? `/api/estimation/${defaultValues?.EstimationID}`
          : '/api/estimation',
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) throw new Error('Save failed');

      if (onSubmitSuccess) onSubmitSuccess();
      else router.push('/estimation');
    } catch (err) {
      console.error('Failed to save estimation:', err);
      alert('Failed to save estimation.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Project Selection */}
      <div>
        <label className="block text-sm font-medium mb-1">Project</label>
        <select {...register('ProjectID', { required: true })} className="input">
          <option value="">-- Select Project --</option>
          {projects.map((proj) => (
            <option key={proj.ProjID} value={proj.ProjID}>
              {proj.ProjName}
            </option>
          ))}
        </select>
        {errors.ProjectID && (
          <p className="text-red-500 text-sm">Project is required.</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          {...register('Title', { required: true })}
          className="input"
        />
        {errors.Title && (
          <p className="text-red-500 text-sm">Title is required.</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea {...register('Description')} className="input" rows={3} />
      </div>

      {/* Submit */}
      <div>
        <button type="submit" className="btn-primary">
          {mode === 'edit' ? 'Update Estimation' : 'Create Estimation'}
        </button>
      </div>
    </form>
  );
}
