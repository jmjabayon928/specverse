// src/components/inventory/InventoryFormClient.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InventoryForm from './InventoryForm';
import { InventoryFormValues } from '@/validation/inventorySchema';

interface ReferenceItem {
  id: number;
  name: string;
}

interface InventoryFormClientProps {
  initialValues: InventoryFormValues;
  mode: 'create' | 'edit';
  categories: ReferenceItem[];
  suppliers: ReferenceItem[];
  manufacturers: ReferenceItem[];
  inventoryId?: number; 
}

export default function InventoryFormClient({
  initialValues,
  mode,
  categories,
  suppliers,
  manufacturers,
  inventoryId,
}: InventoryFormClientProps) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<InventoryFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  }

  const handleSubmit = async (values: InventoryFormValues) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(
        `${baseUrl}/api/backend/inventory/${mode === 'edit' && inventoryId ? inventoryId : ''}`,
        {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) throw new Error('Failed to save inventory item.');

      const result = await response.json();
      const newId = mode === 'edit' ? inventoryId : result.inventoryId;

      router.push(`/inventory/${newId}`);    // ✅ Redirect to detail page
    } catch (error) {
      console.error('Error submitting inventory item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <InventoryForm
      values={formValues}
      setValues={setFormValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      categories={categories}
      suppliers={suppliers}
      manufacturers={manufacturers}
    />
  );
}
