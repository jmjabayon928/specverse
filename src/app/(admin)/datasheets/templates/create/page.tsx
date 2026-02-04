// src/app/(admin)/datasheets/templates/create/page.tsx

import SecurePage from '@/components/security/SecurePage'
import { PERMISSIONS } from '@/constants/permissions'
import TemplateCreatorForm from './TemplateCreatorForm'

const CreateTemplatePage = () => {
  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_CREATE}>
      <TemplateCreatorForm />
    </SecurePage>
  )
}

export default CreateTemplatePage
