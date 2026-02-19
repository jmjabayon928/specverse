// src/config/demoGuide.ts
// Demo guide configuration: audience-specific copy + deep links + page banners
// No runtime dependencies; safe to import in server/client components.

export type DemoAudience = 'investor' | 'recruiter' | 'epcClient' | 'engineeringManager'

export type DemoModule =
  | 'dashboards'
  | 'datasheets'
  | 'estimations'
  | 'inventory'
  | 'schedules'
  | 'verification'
  | 'governance'
  | 'auditLogs'

export type ExperienceId =
  | 'engineeringLifecycle'
  | 'procurementEstimation'
  | 'facilitySchedules'
  | 'qaVerification'
  | 'governanceAudit'

export type IconKey =
  | 'fileText'
  | 'calculator'
  | 'table'
  | 'clipboardCheck'
  | 'shield'
  | 'map'

export type DemoLinkKind = 'primary' | 'secondary' | 'example'

export type RoutePath = `/${string}`

export type DemoLink = Readonly<{
  kind: DemoLinkKind
  label: string
  href: RoutePath
  // Optional: supply query params for “pre-filtered” views (keep it simple)
  searchParams?: Readonly<Record<string, string>>
}>

export type ExperienceCopy = Readonly<{
  title: string
  oneLiner: string
  bullets: readonly [string, string, string]
  ctaLabel: string
}>

export type ExperienceCard = Readonly<{
  id: ExperienceId
  icon: IconKey
  // Which module/area this primarily “lands” on
  primaryModule: DemoModule
  copyByAudience: Readonly<Record<DemoAudience, ExperienceCopy>>
  links: readonly DemoLink[]
}>

export type PageBanner = Readonly<{
  module: DemoModule
  title: string
  body: string
  // Optional: a single action that opens your drawer/modal or routes to capability map
  action?: Readonly<{
    label: string
    href: RoutePath
  }>
}>

export type DemoGuideConfig = Readonly<{
  version: 1
  defaultAudience: DemoAudience
  capabilityMapHref: RoutePath
  guidedTourHref: RoutePath
  experienceCards: readonly ExperienceCard[]
  pageBanners: Readonly<Record<DemoModule, PageBanner>>
}>

// NOTE: Replace the hrefs below with your actual routes.
// I used likely SpecVerse routes based on your repo structure and README.
// Keep the IDs stable, so UI and tests can rely on them.

export const demoGuide: DemoGuideConfig = {
  version: 1,
  defaultAudience: 'epcClient',
  capabilityMapHref: '/capabilities',
  guidedTourHref: '/dashboard?tour=1',
  experienceCards: [
    {
      id: 'engineeringLifecycle',
      icon: 'fileText',
      primaryModule: 'datasheets',
      copyByAudience: {
        investor: {
          title: 'Engineering Datasheet Lifecycle',
          oneLiner: 'Dynamic templates turn datasheets into structured, auditable system-of-record data.',
          bullets: [
            'No-code template engine (no new schema/app builds per format)',
            'Lifecycle control: verify/approve/revise with traceability',
            'Exports become evidence: PDF/Excel with audit section'
          ],
          ctaLabel: 'Open Engineering Lifecycle'
        },
        recruiter: {
          title: 'Engineering Datasheet Lifecycle',
          oneLiner: 'Production-grade workflow: RBAC, revisions, audit logs, multilingual + unit-aware exports.',
          bullets: [
            'Typed fields, UOM validation, translations (DB-backed + i18next)',
            'Revision + approval workflow with strict guards and tests',
            'Puppeteer PDF + ExcelJS exports with embedded audit trails'
          ],
          ctaLabel: 'Open Datasheets'
        },
        epcClient: {
          title: 'Engineering Datasheet Lifecycle',
          oneLiner: 'Standardize datasheets across disciplines with approvals, revisions, and exportable evidence.',
          bullets: [
            'Consistent templates across projects and vendors',
            'Controlled review: Verified → Approved with change history',
            'Handover-ready exports (translated + unit converted)'
          ],
          ctaLabel: 'Open Datasheets'
        },
        engineeringManager: {
          title: 'Engineering Datasheet Lifecycle',
          oneLiner: 'Quality gates and accountability: approvals, revisions, and audit-backed engineering decisions.',
          bullets: [
            'Clear status flow with responsibility boundaries',
            'Revision control with before/after traceability',
            'Exports include audit evidence for reviews and QA'
          ],
          ctaLabel: 'Open Lifecycle View'
        }
      },
      links: [
        { kind: 'primary', label: 'Datasheets', href: '/datasheets/filled' },
        { kind: 'secondary', label: 'Templates', href: '/datasheets/templates' },
        { kind: 'secondary', label: 'Audit trail (datasheets)', href: '/audit-logs', searchParams: { entity: 'datasheet' } },
        { kind: 'secondary', label: 'Open Featured Approved Datasheet', href: '/datasheets/filled/16' }
      ]
    },

    {
      id: 'procurementEstimation',
      icon: 'calculator',
      primaryModule: 'estimations',
      copyByAudience: {
        investor: {
          title: 'Estimation & Supplier Decisions',
          oneLiner: 'Bridges engineering definition to procurement decisions with defendable supplier selection.',
          bullets: [
            'Packages + line items tied to engineering context',
            'Supplier quote comparison and winning selection',
            'Exportable procurement sheets + analytics'
          ],
          ctaLabel: 'Open Estimation Flow'
        },
        recruiter: {
          title: 'Estimation & Supplier Decisions',
          oneLiner: 'End-to-end module: data model, RBAC, exports, analytics, and test coverage.',
          bullets: [
            'Packages, items, quotes, computed totals',
            'Secure APIs with permission enforcement + tests',
            'PDF/Excel export pipelines with job status handling'
          ],
          ctaLabel: 'Open Estimations'
        },
        epcClient: {
          title: 'Estimation & Supplier Decisions',
          oneLiner: 'Compare suppliers, select winners, and produce procurement-ready exports fast.',
          bullets: [
            'Multiple quotes per item with side-by-side comparisons',
            'Transparent totals and selection logic',
            'Procurement sheets per package or full estimate'
          ],
          ctaLabel: 'Open Estimations'
        },
        engineeringManager: {
          title: 'Estimation & Supplier Decisions',
          oneLiner: 'Make procurement defensible: consistent quote comparisons and audit-backed exports.',
          bullets: [
            'Standard structure across projects and teams',
            'Clear selection and pricing traceability',
            'Exports support approvals and review cycles'
          ],
          ctaLabel: 'Open Procurement View'
        }
      },
      links: [
        { kind: 'primary', label: 'Estimations', href: '/estimation' },
        { kind: 'secondary', label: 'Past estimates', href: '/estimation/history' },
        { kind: 'secondary', label: 'Estimation analytics', href: '/dashboard/analytics', searchParams: { view: 'estimations' } },
        { kind: 'secondary', label: 'Open Featured Estimation', href: '/estimation/1' }
      ]
    },

    {
      id: 'facilitySchedules',
      icon: 'table',
      primaryModule: 'schedules',
      copyByAudience: {
        investor: {
          title: 'Facility Schedules at Scale',
          oneLiner: 'Asset-first schedules provide facility-level operational visibility without losing auditability.',
          bullets: [
            'Typed columns (string/number/date/enum) with invariants',
            'Safe bulk edits via transactional replace-all saves',
            'Schedule ↔ asset ↔ datasheet linkage'
          ],
          ctaLabel: 'Open Schedules'
        },
        recruiter: {
          title: 'Facility Schedules at Scale',
          oneLiner: 'Hard problems solved: typed cells, uniqueness rules, transactional writes, and audit safety.',
          bullets: [
            'One typed value per cell enforced',
            'No duplicate assets per schedule; no duplicate column keys',
            'Replace-all transactional semantics tested'
          ],
          ctaLabel: 'Open Schedules'
        },
        epcClient: {
          title: 'Facility Schedules at Scale',
          oneLiner: 'Manage many similar assets consistently with bulk editing and clean exports.',
          bullets: [
            'Asset-linked schedules for real facilities',
            'Fast bulk updates without spreadsheet chaos',
            'Exports for handover and operations'
          ],
          ctaLabel: 'Open Schedules'
        },
        engineeringManager: {
          title: 'Facility Schedules at Scale',
          oneLiner: 'Keep asset data consistent at scale with typed validation and audit-backed bulk edits.',
          bullets: [
            'Enforced consistency across hundreds of assets',
            'Controlled edits with traceability',
            'Links to datasheets for drill-down'
          ],
          ctaLabel: 'Open Facility View'
        }
      },
      links: [
        { kind: 'primary', label: 'Schedules', href: '/schedules' },
        { kind: 'secondary', label: 'Schedule analytics', href: '/dashboard/analytics', searchParams: { view: 'schedules' } },
        { kind: 'secondary', label: 'Open Featured Pump Schedule', href: '/schedules/4' }
      ]
    },

    {
      id: 'qaVerification',
      icon: 'clipboardCheck',
      primaryModule: 'verification',
      copyByAudience: {
        investor: {
          title: 'QA / Verification Records',
          oneLiner: 'Compliance-ready evidence: verification is first-class, linked, and exportable.',
          bullets: [
            'Verification records linked to assets and datasheets',
            'Evidence attachments + traceability',
            'Audit visibility supports regulated workflows'
          ],
          ctaLabel: 'Open Verification'
        },
        recruiter: {
          title: 'QA / Verification Records',
          oneLiner: 'Traceability by design: linked entities, audit trails, and permission-gated access.',
          bullets: [
            'Entity linking: datasheets/assets/attachments',
            'RBAC enforcement across API + UI',
            'Audit log consistency and pagination guarantees'
          ],
          ctaLabel: 'Open Verification'
        },
        epcClient: {
          title: 'QA / Verification Records',
          oneLiner: 'Track inspections and evidence so handover isn’t a scramble at the end of the project.',
          bullets: [
            'Records tied to equipment and datasheets',
            'Attachments organized as evidence',
            'Traceability supports client acceptance'
          ],
          ctaLabel: 'Open QA / Verification'
        },
        engineeringManager: {
          title: 'QA / Verification Records',
          oneLiner: 'Make QA measurable: verification linked to the engineering objects that matter.',
          bullets: [
            'Clear evidence chain for reviews',
            'Consistent records across teams',
            'Audit-backed accountability'
          ],
          ctaLabel: 'Open QA'
        }
      },
      links: [
        { kind: 'primary', label: 'Verification', href: '/verification-records' },
        { kind: 'secondary', label: 'Audit trail (verification)', href: '/audit-logs', searchParams: { entity: 'verification' } }
      ]
    },

    {
      id: 'governanceAudit',
      icon: 'shield',
      primaryModule: 'governance',
      copyByAudience: {
        investor: {
          title: 'Governance, RBAC & Audit',
          oneLiner: 'Enterprise-grade multi-tenant isolation with explicit permissions and provable auditing.',
          bullets: [
            'Account Owner vs Admin vs Platform Superadmin separation',
            'Permission-driven RBAC (no implicit access)',
            'Audit visibility for support and compliance'
          ],
          ctaLabel: 'Open Governance'
        },
        recruiter: {
          title: 'Governance, RBAC & Audit',
          oneLiner: 'Security-first architecture: multi-tenant scoping, RBAC enforcement, and test-verified isolation.',
          bullets: [
            '401/403/404 behaviors standardized and tested',
            'No cross-tenant data leakage (provable)',
            'Audit trails across modules and exports'
          ],
          ctaLabel: 'Open Governance'
        },
        epcClient: {
          title: 'Governance, RBAC & Audit',
          oneLiner: 'Put the right controls around engineering data: approvals, permissions, and traceability.',
          bullets: [
            'Roles align to real teams (Engineer/QA/Estimator/Maintenance)',
            'Controlled approvals and accountability',
            'Audit logs support disputes and handover evidence'
          ],
          ctaLabel: 'Open Governance'
        },
        engineeringManager: {
          title: 'Governance, RBAC & Audit',
          oneLiner: 'Prevent uncontrolled edits with permission boundaries and audit-backed accountability.',
          bullets: [
            'Clear authority layers (Owner/Admin/Role permissions)',
            'Auditable actions across engineering workflows',
            'Supports QA/QC and review discipline'
          ],
          ctaLabel: 'Open Controls'
        }
      },
      links: [
        { kind: 'primary', label: 'Account & Roles', href: '/settings/roles' },
        { kind: 'secondary', label: 'Audit Logs', href: '/audit-logs' },
        { kind: 'secondary', label: 'Platform Admin (if enabled)', href: '/superadmin' }
      ]
    }
  ],
  pageBanners: {
    dashboards: {
      module: 'dashboards',
      title: 'Explore SpecVerse in minutes',
      body:
        'Use the Experience Cards to follow a guided path through engineering lifecycle, procurement, facility schedules, QA verification, and governance.',
      action: { label: 'View Capability Map', href: '/capabilities' }
    },
    datasheets: {
      module: 'datasheets',
      title: 'Structured datasheets with lifecycle control',
      body:
        'Templates define structure at runtime. Filled datasheets follow verify/approve/revise workflows with full audit trails and exportable evidence.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    estimations: {
      module: 'estimations',
      title: 'Procurement-aware estimation',
      body:
        'Create packages, compare supplier quotes, compute totals, and export procurement-ready PDF/Excel reports—permission enforced and auditable.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    inventory: {
      module: 'inventory',
      title: 'Asset-linked inventory visibility',
      body:
        'Inventory items link to engineering and estimation workflows. Transactions and maintenance logs are traceable, exportable, and scoped by role.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    schedules: {
      module: 'schedules',
      title: 'Facility schedules at scale',
      body:
        'Asset-first schedule tables with typed cells, strong invariants, and transactional bulk saves—built for consistent facility documentation.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    verification: {
      module: 'verification',
      title: 'QA / verification as first-class evidence',
      body:
        'Verification records link to assets, datasheets, and attachments so inspections stay traceable and handover becomes defensible.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    governance: {
      module: 'governance',
      title: 'Governance and permission boundaries',
      body:
        'SpecVerse enforces account isolation and permission-driven RBAC. Ownership is separate from roles, and critical actions are audit logged.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    },
    auditLogs: {
      module: 'auditLogs',
      title: 'Unified audit and traceability',
      body:
        'Audit logs provide a consistent, entity-aware trail across datasheets, estimations, inventory, schedules, and governance actions—safe for compliance.',
      action: { label: 'Back to Dashboard Guide', href: '/dashboard' }
    }
  }
}
