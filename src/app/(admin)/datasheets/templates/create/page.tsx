// src/app/(admin)/datasheets/templates/create/page.tsx
import TemplateCreatorForm from './TemplateCreatorForm';
import { getTemplateReferenceOptions } from '@/backend/database/templateReferenceQueries';

export default async function CreateTemplatePage() {
  const {
    areas,
    users,
    manufacturers,
    suppliers,
    categories,
    clients,
    projects,
  } = await getTemplateReferenceOptions();

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6">
      <TemplateCreatorForm
        areas={areas}
        users={users}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
        today={today}
      />
    </div>
  );
}
