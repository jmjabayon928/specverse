export type CapabilityPageModel = {
  hero: { title: string; subtitle: string }
  sections: CapabilitySectionModel[]
}

export type CapabilitySectionModel = {
  id: 'architecture' | 'data-layer' | 'application-layer' | 'governance' | 'lifecycle' | 'observability' | 'extensibility'
  title: string
  description: string
  items: CapabilityItemModel[]
}

export type CapabilityItemModel = {
  title: string
  bullets: string[]
  tags?: string[]
}

export const capabilitiesPageModel: CapabilityPageModel = {
  hero: {
    title: 'SpecVerse Capabilities',
    subtitle: 'Technical architecture and platform capabilities for engineering data management'
  },
  sections: [
    {
      id: 'architecture',
      title: 'Architecture',
      description: 'Modular, service-oriented architecture with clear separation of concerns and strict type safety.',
      items: [
        {
          title: 'Service Layer',
          bullets: [
            'Domain services encapsulate business logic',
            'Repository pattern for data access abstraction',
            'Type-safe interfaces across layers'
          ],
          tags: ['Services', 'Repositories']
        },
        {
          title: 'API Layer',
          bullets: [
            'RESTful endpoints with consistent error handling',
            'Request validation and response serialization',
            'Permission-based access control at route level'
          ],
          tags: ['API', 'REST']
        },
        {
          title: 'Frontend Architecture',
          bullets: [
            'Next.js App Router with server/client component separation',
            'Component composition with reusable UI primitives',
            'Client-side state management for interactive features'
          ],
          tags: ['Next.js', 'React']
        }
      ]
    },
    {
      id: 'data-layer',
      title: 'Data Layer',
      description: 'Structured data models with migrations, referential integrity, and audit support.',
      items: [
        {
          title: 'Database Schema',
          bullets: [
            'PostgreSQL with typed columns and constraints',
            'Foreign key relationships for data integrity',
            'Indexed columns for query performance'
          ],
          tags: ['PostgreSQL', 'Schema']
        },
        {
          title: 'Migrations',
          bullets: [
            'Versioned schema migrations',
            'Data transformation scripts where needed'
          ],
          tags: ['Migrations']
        },
        {
          title: 'Data Models',
          bullets: [
            'Strongly typed domain models',
            'Validation at model boundaries',
            'Audit fields (createdAt, updatedAt, performedBy)'
          ],
          tags: ['Models', 'Types']
        }
      ]
    },
    {
      id: 'application-layer',
      title: 'Application Layer',
      description: 'Core business modules for engineering workflows: datasheets, estimations, schedules, and verification.',
      items: [
        {
          title: 'Datasheets',
          bullets: [
            'Template-based datasheet creation',
            'Filled datasheet instances with revision tracking',
            'Status workflow: Draft → Verified → Approved',
            'Export to PDF and Excel with embedded audit trails'
          ],
          tags: ['Templates', 'Workflow']
        },
        {
          title: 'Estimation',
          bullets: [
            'Package and line item structure',
            'Supplier quote comparison and selection',
            'Computed totals with audit visibility',
            'Exportable procurement reports'
          ],
          tags: ['Procurement', 'Quotes']
        },
        {
          title: 'Schedules',
          bullets: [
            'Asset-first schedule tables',
            'Typed columns with validation',
            'Bulk edit operations with transactional safety',
            'Linkage to datasheets and assets'
          ],
          tags: ['Schedules', 'Assets']
        },
        {
          title: 'Verification Records',
          bullets: [
            'Verification records linked to assets and datasheets',
            'Evidence attachments with traceability',
            'Compliance-ready audit visibility'
          ],
          tags: ['QA', 'Verification']
        }
      ]
    },
    {
      id: 'governance',
      title: 'Governance',
      description: 'Multi-tenant isolation, role-based access control, audit trails, and operational safety controls.',
      items: [
        {
          title: 'Multi-Tenant Account Scoping',
          bullets: [
            'Account-level data isolation',
            'Cross-tenant access prevention',
            'Account owner and admin separation'
          ],
          tags: ['Multi-Tenant', 'Isolation']
        },
        {
          title: 'RBAC and Permissions',
          bullets: [
            'Role-based permission assignment',
            'Permission-driven API and UI access control',
            'Explicit permission checks (no implicit access)',
            'Role hierarchy: Account Owner → Admin → Role Permissions'
          ],
          tags: ['RBAC', 'Permissions']
        },
        {
          title: 'Audit Trails',
          bullets: [
            'Comprehensive audit logging across modules',
            'Entity-aware audit records with action tracking',
            'Audit log pagination and filtering',
            'Exportable audit evidence for compliance'
          ],
          tags: ['Audit', 'Compliance']
        },
        {
          title: 'Verification Workflow',
          bullets: [
            'Controlled verification and approval processes',
            'Status transitions with permission gates',
            'Revision tracking with before/after comparison',
            'Workflow accountability and traceability'
          ],
          tags: ['Workflow', 'Approval']
        },
        {
          title: 'Operational Safety',
          bullets: [
            'Transaction boundaries for data consistency',
            'Error handling with user-friendly messages',
            'Input validation at API boundaries',
            'Safe bulk operations with rollback support'
          ],
          tags: ['Safety', 'Transactions']
        }
      ]
    },
    {
      id: 'lifecycle',
      title: 'Lifecycle Management',
      description: 'Controlled workflows for datasheet and estimation lifecycles with status tracking and revision control.',
      items: [
        {
          title: 'Datasheet Lifecycle',
          bullets: [
            'Draft → Verified → Approved status flow',
            'Rejection and revision paths',
            'Revision history with diff comparison',
            'Status-based permission enforcement'
          ],
          tags: ['Workflow', 'Status']
        },
        {
          title: 'Lifecycle Flow',
          bullets: [
            'Draft → Modified Draft → Verified → Approved',
            'Rejected → Modified Draft (revision)',
            'Approved → (locked, requires new revision for changes)'
          ]
        },
        {
          title: 'Estimation Lifecycle',
          bullets: [
            'Draft → For Review → Approved',
            'Package and item-level tracking',
            'Supplier quote selection workflow',
            'Export-ready approval gates'
          ],
          tags: ['Estimation', 'Approval']
        }
      ]
    },
    {
      id: 'observability',
      title: 'Observability',
      description: 'Audit logs, change tracking, and visibility into system operations and user actions.',
      items: [
        {
          title: 'Audit Logging',
          bullets: [
            'Entity-level audit records',
            'Action tracking with timestamps and actors',
            'Change tracking with before/after values',
            'Route and method logging for API calls'
          ],
          tags: ['Audit', 'Logging']
        },
        {
          title: 'Change History',
          bullets: [
            'Revision tracking for datasheets',
            'Diff views for revision comparison',
            'Change attribution with user and timestamp',
            'Exportable change logs'
          ],
          tags: ['History', 'Revisions']
        },
        {
          title: 'Dashboard Analytics',
          bullets: [
            'Status distribution charts',
            'Time-series data visualization',
            'Permission-filtered data views',
            'Export-ready analytics'
          ],
          tags: ['Analytics', 'Dashboard']
        }
      ]
    },
    {
      id: 'extensibility',
      title: 'Extensibility',
      description: 'Modular design patterns and extension points for future capabilities and integrations.',
      items: [
        {
          title: 'Module Architecture',
          bullets: [
            'Independent module boundaries',
            'Shared utilities and type definitions',
            'Consistent API patterns across modules',
            'Service interfaces designed for extension'
          ],
          tags: ['Modules', 'Architecture']
        },
        {
          title: 'Template System',
          bullets: [
            'Runtime template definitions',
            'No-code template creation',
            'Dynamic field configuration',
            'Template cloning'
          ],
          tags: ['Templates', 'Configuration']
        },
        {
          title: 'Export Pipeline',
          bullets: [
            'Pluggable export formats (PDF, Excel)',
            'Customizable export templates',
            'Export processing'
          ],
          tags: ['Export', 'Pipeline']
        }
      ]
    }
  ]
}
