'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EstimationForm from '@/components/estimation/EstimationForm';
import { Estimation } from '@/types/estimation';

export default function EditEstimationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [estimation, setEstimation] = useState<Estimation | null>(null);

  useEffect(() => {
    const fetchEstimation = async () => {
      const res = await fetch(`/api/estimation/${id}`);
      const data = await res.json();
      setEstimation(data);
    };
    if (id) fetchEstimation();
  }, [id]);

  if (!estimation) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Estimation</h1>
      <EstimationForm
        mode="edit"
        defaultValues={estimation}
        onSubmitSuccess={() => router.push('/estimation')}
      />
    </div>
  );
}
