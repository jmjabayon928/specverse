// src/components/estimation/EstimationForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Estimation } from '@/domain/estimations/estimationTypes';
import { Project } from '@/domain/projects/projectTypes';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<EstimationFormData>({
    defaultValues: {
      ProjectID: defaultValues?.ProjectID ?? undefined,
      Title: defaultValues?.Title ?? '',
      Description: defaultValues?.Description ?? '',
    },
  });

  // ✅ Fetch project options
  useEffect(() => {
    function toProjectList(raw: unknown): Project[] {
      if (Array.isArray(raw)) return raw as Project[];
      if (raw !== null && typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        if (Array.isArray(o.recordset)) return o.recordset as Project[];
        if (Array.isArray(o.rows)) return o.rows as Project[];
        if (Array.isArray(o.data)) return o.data as Project[];
      }
      return [];
    }

    const fetchProjects = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/projects`);
        const data: unknown = await res.json();
        const projectsList = toProjectList(data);
        setProjects(projectsList);

        // ✅ Set selected project only after options are available
        if (defaultValues?.ProjectID) {
          const match = projectsList.find((p) => p.ProjectID === defaultValues.ProjectID);
          if (match) {
            setValue('ProjectID', match.ProjectID);
          }
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };

    fetchProjects();
  }, [defaultValues?.ProjectID, baseUrl, setValue]);

  // ✅ Handle submit
  const onSubmit = async (data: EstimationFormData) => {
    try {
      const res = await fetch(
        mode === 'edit'
          ? `${baseUrl}/api/backend/estimation/${defaultValues?.EstimationID}`
          : `${baseUrl}/api/backend/estimation`,
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
        <select
          {...register('ProjectID', { required: true })}
          className="input"
        >
          <option value="">-- Select Project --</option>
          {projects.map((proj) => (
            <option key={proj.ProjectID} value={proj.ProjectID}>
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
      <div className="flex justify-between items-center gap-3">
        <button
          type="submit"
          className={`text-white font-medium px-4 py-2 rounded shadow ${
            mode === 'edit'
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {mode === 'edit' ? 'Update' : 'Add Estimation'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (onSubmitSuccess) onSubmitSuccess(); // acts as a cancel handler too
            else router.push('/estimation');
          }}
          className="text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2 rounded shadow"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
