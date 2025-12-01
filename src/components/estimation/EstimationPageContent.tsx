'use client';

import React from 'react';
import { Estimation } from "@/domain/estimations/estimationTypes";
import EstimationTable from '@/components/estimation/EstimationTable';

interface EstimationPageContentProps {
  estimations: Estimation[];
  onDelete?: () => void;
}

const EstimationPageContent: React.FC<EstimationPageContentProps> = ({ estimations, onDelete }) => {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Estimations</h1>
      <EstimationTable estimations={estimations} onDelete={onDelete} />
    </div>
  );
};

export default EstimationPageContent;
