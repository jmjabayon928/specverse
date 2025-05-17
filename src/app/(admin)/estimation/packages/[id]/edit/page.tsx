'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PackageForm from '@/components/estimation/PackageForm';
import { EstimationPackage } from '@/types/estimation';

export default function EditPackagePage() {
  const { id } = useParams();
  const router = useRouter();
  const [pkg, setPkg] = useState<EstimationPackage | null>(null);

  useEffect(() => {
    const fetchPackage = async () => {
      const res = await fetch(`/api/estimation/packages/${id}`);
      const data = await res.json();
      setPkg(data);
    };
    if (id) fetchPackage();
  }, [id]);

  if (!pkg) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Package</h1>
      <PackageForm
        mode="edit"
        defaultValues={pkg}
        onSubmitSuccess={() => router.push(`/estimation/${pkg.EstimationID}`)}
      />
    </div>
  );
}
