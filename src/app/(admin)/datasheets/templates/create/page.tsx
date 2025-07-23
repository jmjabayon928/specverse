// src/app/(admin)/datasheets/templates/create/page.tsx

"use client";

import React from "react";
import SecurePage from "@/components/security/SecurePage";
import TemplateCreatorForm from "./TemplateCreatorForm";

export default function CreateTemplatePage() {
  return (
    <SecurePage requiredPermission="TEMPLATE_CREATE">
      <TemplateCreatorForm mode="create" />
    </SecurePage>
  );
}
