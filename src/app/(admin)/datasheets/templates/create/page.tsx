// src/app/(admin)/datasheets/templates/create/page.tsx

import SecurePage from '@/components/security/SecurePage'
import TemplateCreatorForm from './TemplateCreatorForm'

const CreateTemplatePage = () => {
  return (
    <SecurePage requiredPermission='DATASHEET_CREATE'>
      <TemplateCreatorForm />
    </SecurePage>
  )
}

export default CreateTemplatePage
