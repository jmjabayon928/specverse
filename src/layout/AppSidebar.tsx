// src/layout/AppSidebar.tsx
'use client'

import { ChevronDown } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSidebar } from '../context/SidebarContext'
import { useSession } from '@/hooks/useSession'
import {
  GridIcon,
  HorizontaLDots,
} from '../icons/index'
import {
  EstimationIcon,
  DataSheetsIcon,
  AdministrationIcon,
  InventoryIcon,
  ReportsIcon,
  AnalyticsIcon,
} from '../components/icons/index'
import { PERMISSIONS } from '@/constants/permissions'
import styles from './AppSidebar.module.css'

const FEATURE_REVISIONS_ENABLED = false
const FEATURE_MIRROR_ENABLED = false

type SubNavItem = {
  name: string
  path: string
  pro?: boolean
  new?: boolean
  /** Permission-based: show only if user has this permission or is admin (used when parent is permission-gated) */
  requiredPermission?: string
  /** Role-based: only for Administration children */
  roles?: string[]
}

type NavItem = {
  name: string
  icon: React.ReactNode
  path?: string
  /** Permission-based: show when user has this permission or is admin */
  requiredPermission?: string
  /** Role-based (Administration only): show when user role is in this list */
  roles?: string[]
  subItems?: SubNavItem[]
}

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: 'Dashboard',
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
    subItems: [
      { name: 'Overview & Stats', path: '/', pro: false }
    ],
  },
  {
    icon: <DataSheetsIcon />,
    name: 'DataSheets',
    requiredPermission: PERMISSIONS.DATASHEET_VIEW,
    subItems: [
      { name: 'Templates', path: '/datasheets/templates', pro: false },
      { name: 'Filled Forms', path: '/datasheets/filled', pro: false },
      ...(FEATURE_REVISIONS_ENABLED
        ? [{ name: 'Revisions', path: '/datasheets/revisions', pro: false }]
        : []),
      { name: 'Layouts (Builder)', path: '/datasheets/layouts', pro: false },
          ...(FEATURE_MIRROR_ENABLED
            ? [{ name: 'Mirror (Preview)', path: '/datasheets/mirror', pro: false }]
            : []),
    ],
  },
  {
    icon: <EstimationIcon />,
    name: 'Project Estimation',
    requiredPermission: PERMISSIONS.ESTIMATION_VIEW,
    subItems: [
      { name: 'Estimation List', path: '/estimation' },
      { name: 'Estimation Packages', path: '/estimation/packages' },
      { name: 'Estimation Quotes', path: '/estimation/quotes' },
      { name: 'Browse Past Estimates', path: '/estimation/history' },
    ],
  },
  {
    icon: <InventoryIcon />,
    name: 'Inventory',
    requiredPermission: PERMISSIONS.INVENTORY_VIEW,
    subItems: [
      { name: 'Inventory Items', path: '/inventory' },
      { name: 'Transactions', path: '/inventory/transactions' },
      { name: 'Maintenance', path: '/inventory/maintenance' },
      { name: 'Audit Logs', path: '/inventory/logs' },
    ],
  },
  {
    icon: <AdministrationIcon />,
    name: 'Administration',
    roles: ['admin'],
    subItems: [
      { name: 'Users', path: '/settings/users', pro: false },
      { name: 'Members', path: '/settings/members', pro: false },
      { name: 'Roles', path: '/settings/roles', pro: false },
      { name: 'Permissions', path: '/settings/permissions', pro: false },
      { name: 'Projects', path: '/settings/projects', pro: false },
      { name: 'Clients', path: '/settings/clients', pro: false },
      { name: 'Manufacturers', path: '/settings/manufacturers', pro: false },
      { name: 'Suppliers', path: '/settings/suppliers', pro: false },
      { name: 'Audit Logs', path: '/audit-logs', pro: false },
    ],
  },
  {
    icon: <AnalyticsIcon />,
    name: 'Analytics',
    path: '/dashboard/analytics',
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    icon: <ReportsIcon />,
    name: 'Reports',
    path: '/dashboard/reports',
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
]

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar()
  const { user, loading } = useSession()
  const pathname = usePathname()

  const userRole = user?.role?.toLowerCase() ?? ''
  const permissions = useMemo(() => user?.permissions ?? [], [user?.permissions])

  const hasPermission = useCallback(
    (permission: string) => {
      if (!permission) return false
      if (userRole === 'admin') return true
      return permissions.includes(permission)
    },
    [userRole, permissions]
  )

  const [openSubmenuKey, setOpenSubmenuKey] = useState<string | null>(null)
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({})
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const isActive = useCallback((path: string) => path === pathname, [pathname])

  useEffect(() => {
    const filtered = navItems
      .filter(nav => {
        if (nav.requiredPermission != null) return hasPermission(nav.requiredPermission)
        if (nav.roles != null && nav.roles.length > 0) return nav.roles.includes(userRole)
        return true
      })
      .map(nav => {
        let subItems: SubNavItem[] | undefined
        if (nav.requiredPermission != null) {
          subItems = nav.subItems?.filter(
            s => !s.requiredPermission || hasPermission(s.requiredPermission)
          )
        } else {
          subItems = nav.subItems?.filter(
            s => !s.roles || s.roles.includes(userRole)
          )
        }
        return { ...nav, subItems }
      })
      .filter(nav => (nav.subItems && nav.subItems.length > 0) || nav.path)

    let matchedKey: string | null = null
    for (const nav of filtered) {
      if (!nav.subItems) continue
      for (const sub of nav.subItems) {
        if (isActive(sub.path)) {
          matchedKey = nav.name
          break
        }
      }
      if (matchedKey) break
    }
    setOpenSubmenuKey(matchedKey)
  }, [pathname, isActive, hasPermission, userRole])

  useEffect(() => {
    if (openSubmenuKey !== null) {
      const ref = subMenuRefs.current[openSubmenuKey]
      if (ref) {
        setSubMenuHeight(prev => ({
          ...prev,
          [openSubmenuKey]: ref.scrollHeight,
        }))
      }
    }
  }, [openSubmenuKey])

  const handleSubmenuToggle = (key: string) => {
    setOpenSubmenuKey(prev => (prev === key ? null : key))
  }

  // ---- Helpers ----

  type NavPrimaryContext = {
    isExpanded: boolean
    isHovered: boolean
    isMobileOpen: boolean
    openSubmenuKey: string | null
    handleSubmenuToggle?: (key: string) => void
  }

  const renderNavPrimary = (
    nav: NavItem,
    index: number,
    isActiveFn: (path: string) => boolean,
    context: NavPrimaryContext
  ) => {
    if (nav.subItems && nav.subItems.length > 0) {
      const isOpen = context.openSubmenuKey === nav.name

      const baseClass = 'menu-item group cursor-pointer'
      const activeClass = isOpen ? 'menu-item-active' : 'menu-item-inactive'
      const justifyClass =
        !context.isExpanded && !context.isHovered
          ? 'lg:justify-center'
          : 'lg:justify-start'

      const iconClass = isOpen
        ? 'menu-item-icon-active'
        : 'menu-item-icon-inactive'

      const showText =
        context.isExpanded || context.isHovered || context.isMobileOpen

      return (
        <button
          type="button"
          onClick={() => context.handleSubmenuToggle?.(nav.name)}
          className={`${baseClass} ${activeClass} ${justifyClass}`}
        >
          <span className={iconClass}>{nav.icon}</span>
          {showText && <span className="menu-item-text">{nav.name}</span>}
          {showText && (
            <ChevronDown
              className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-brand-500' : ''
              }`}
            />
          )}
        </button>
      )
    }

    if (nav.path === undefined) {
      return null
    }

    const active = isActiveFn(nav.path)
    const baseClass = 'menu-item group'
    const activeClass = active ? 'menu-item-active' : 'menu-item-inactive'
    const iconClass = active
      ? 'menu-item-icon-active'
      : 'menu-item-icon-inactive'
    const showText =
      context.isExpanded || context.isHovered || context.isMobileOpen

    return (
      <Link href={nav.path} className={`${baseClass} ${activeClass}`}>
        <span className={iconClass}>{nav.icon}</span>
        {showText && <span className="menu-item-text">{nav.name}</span>}
      </Link>
    )
  }

  type NavSubmenuContext = {
    isExpanded: boolean
    isHovered: boolean
    isMobileOpen: boolean
    openSubmenuKey: string | null
    subMenuHeight: Record<string, number>
    subMenuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  }

  const renderNavSubmenu = (
    nav: NavItem,
    index: number,
    isActiveFn: (path: string) => boolean,
    context: NavSubmenuContext
  ) => {
    const shouldShow =
      nav.subItems &&
      (context.isExpanded || context.isHovered || context.isMobileOpen)

    if (!shouldShow || !nav.subItems) {
      return null
    }

    const key = nav.name
    const rawHeight = context.subMenuHeight[key] ?? 0
    const isOpen = context.openSubmenuKey === nav.name
    const heightValue = isOpen ? String(rawHeight) + 'px' : '0px'

    const setSubMenuRef = (el: HTMLDivElement | null) => {
      context.subMenuRefs.current[key] = el
    }

    return (
      <div className={styles.submenuWrapper}>
        <div
          ref={setSubMenuRef}
          className="submenu-wrapper overflow-hidden transition-all duration-300"
          style={{ '--submenu-height': heightValue } as React.CSSProperties}
        >
          <ul className="mt-2 space-y-1 ml-9">
          {nav.subItems.map(subItem => {
            const active = isActiveFn(subItem.path)
            const itemClass = active
              ? 'menu-dropdown-item menu-dropdown-item-active'
              : 'menu-dropdown-item menu-dropdown-item-inactive'

            return (
              <li key={subItem.name}>
                <Link href={subItem.path} className={itemClass}>
                  {subItem.name}
                  <span className="flex items-center gap-1 ml-auto">
                    {subItem.new && (
                      <span className="menu-dropdown-badge menu-dropdown-badge-inactive">
                        new
                      </span>
                    )}
                    {subItem.pro && (
                      <span className="menu-dropdown-badge menu-dropdown-badge-inactive">
                        pro
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
          </ul>
        </div>
      </div>
    )
  }

  const renderMenuItems = () => {
    const filtered = navItems
      .filter(nav => {
        if (nav.requiredPermission != null) {
          return hasPermission(nav.requiredPermission)
        }
        if (nav.roles != null && nav.roles.length > 0) {
          return nav.roles.includes(userRole)
        }
        return true
      })
      .map(nav => {
        let subItems: SubNavItem[] | undefined
        if (nav.requiredPermission != null) {
          // Permission-gated parent: child inherits parent permission unless child has its own requiredPermission
          subItems = nav.subItems?.filter(
            s => !s.requiredPermission || hasPermission(s.requiredPermission)
          )
        } else {
          // Role-based (e.g. Administration): filter by child.roles / userRole
          subItems = nav.subItems?.filter(
            s => !s.roles || s.roles.includes(userRole)
          )
        }
        return { ...nav, subItems }
      })
      .filter(nav => (nav.subItems && nav.subItems.length > 0) || nav.path)

    return (
      <ul className="flex flex-col gap-4">
        {filtered.map((nav, index) => {
          const primaryContext: NavPrimaryContext = {
            isExpanded,
            isHovered,
            isMobileOpen,
            openSubmenuKey,
            handleSubmenuToggle,
          }

          const submenuContext: NavSubmenuContext = {
            isExpanded,
            isHovered,
            isMobileOpen,
            openSubmenuKey,
            subMenuHeight,
            subMenuRefs,
          }

          return (
            <li key={nav.name}>
              {renderNavPrimary(nav, index, isActive, primaryContext)}
              {renderNavSubmenu(nav, index, isActive, submenuContext)}
            </li>
          )
        })}
      </ul>
    )
  }

  const sidebarWidth =
    isExpanded || isMobileOpen || isHovered ? 'w-[290px]' : 'w-[90px]'

  return (
    <aside
      className={`
        fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 
        dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out 
        z-50 border-r border-gray-200 
        ${sidebarWidth}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/SpecVerse150x40.png"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/SpecVerse150x40.png"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/SpecVerse32x32.png"
              alt="Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? 'lg:justify-center'
                    : 'justify-start'
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? 'Menu' : <HorizontaLDots />}
              </h2>
              {loading ? (
                <ul className="flex flex-col gap-4" aria-hidden="true">
                  <li className="h-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <li className="h-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <li className="h-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </ul>
              ) : (
                renderMenuItems()
              )}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}

export default AppSidebar
