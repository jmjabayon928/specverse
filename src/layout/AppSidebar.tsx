"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
} from "../icons/index";
import {
  EstimationIcon,
  DataSheetsIcon,
  AdministrationIcon,
  InventoryIcon,
  ReportsIcon,
} from "../components/icons/index";

const userRole = "admin";

type SubNavItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  roles?: string[];
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  roles?: string[];
  subItems?: SubNavItem[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    roles: ["admin", "manager", "estimator", "user"],
    subItems: [
      { name: "Overview & Stats", path: "/", pro: false },
      { name: "Alerts & Warnings", path: "/alerts", pro: false },
    ],
  },
  {
    icon: <DataSheetsIcon />,
    name: "DataSheets",
    roles: ["admin", "engineer", "estimator", "qa"],
    subItems: [
      { name: "Templates", path: "/datasheets/templates", pro: false },
      { name: "Filled Forms", path: "/datasheets/filled", pro: false },
      { name: "Revisions", path: "/datasheets/revisions", pro: false },
    ],
  },
  {
    icon: <EstimationIcon />,
    name: "Project Estimation",
    roles: ["admin", "estimator", "manager"],
    subItems: [
      { name: "Estimation List", path: "/estimation" },
      { name: "Estimation Packages", path: "/estimation/packages" },
      { name: "Estimation Quotes", path: "/estimation/quotes" },
      { name: "Browse Past Estimates", path: "/estimation/history" },
    ],
  },
  {
    icon: <InventoryIcon />,
    name: "Inventory",
    roles: ["admin", "warehouse", "maintenance"],
    subItems: [
      { name: "Inventory Items", path: "/inventory" },
      { name: "Transactions", path: "/inventory/transactions" },
      { name: "Maintenance", path: "/inventory/maintenance" },
      { name: "Audit Logs", path: "/inventory/logs" },
    ],
  },
  {
    icon: <ReportsIcon />,
    name: "Reports",
    roles: ["admin", "manager", "estimator"],
    subItems: [
      { name: "Datasheet Reports", path: "/reports/datasheets" },
      { name: "Inventory Reports", path: "/reports/inventory" },
      { name: "Estimation Reports", path: "/reports/estimations" },
    ],
  },
  {
    icon: <AdministrationIcon />,
    name: "Administration",
    roles: ["admin"],
    subItems: [
      { name: "User Management", path: "/admin/users", pro: false },
      { name: "System Settings", path: "/admin/settings", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    let matched = false;
    navItems.forEach((nav, index) => {
      nav.subItems?.forEach((sub) => {
        if (isActive(sub.path)) {
          setOpenSubmenuIndex(index);
          matched = true;
        }
      });
    });
    if (!matched) setOpenSubmenuIndex(null);
  }, [pathname, isActive]);

  useEffect(() => {
    if (openSubmenuIndex !== null) {
      const key = `main-${openSubmenuIndex}`;
      const ref = subMenuRefs.current[key];
      if (ref) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: ref.scrollHeight,
        }));
      }
    }
  }, [openSubmenuIndex]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenuIndex((prev) => (prev === index ? null : index));
  };

  const renderMenuItems = () => {
    const filtered = navItems
      .filter((nav) => !nav.roles || nav.roles.includes(userRole))
      .map((nav) => {
        const subItems = nav.subItems?.filter(
          (s) => !s.roles || s.roles.includes(userRole)
        );
        return { ...nav, subItems };
      })
      .filter((nav) => nav.subItems?.length || nav.path);

    return (
      <ul className="flex flex-col gap-4">
        {filtered.map((nav, index) => (
          <li key={nav.name}>
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(index)}
                className={`menu-item group ${
                  openSubmenuIndex === index
                    ? "menu-item-active"
                    : "menu-item-inactive"
                } cursor-pointer ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "lg:justify-start"
                }`}
              >
                <span
                  className={
                    openSubmenuIndex === index
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
                {(isExpanded || isHovered || isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                      openSubmenuIndex === index
                        ? "rotate-180 text-brand-500"
                        : ""
                    }`}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  href={nav.path}
                  className={`menu-item group ${
                    isActive(nav.path)
                      ? "menu-item-active"
                      : "menu-item-inactive"
                  }`}
                >
                  <span
                    className={
                      isActive(nav.path)
                        ? "menu-item-icon-active"
                        : "menu-item-icon-inactive"
                    }
                  >
                    {nav.icon}
                  </span>
                  {(isExpanded || isHovered || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}
                </Link>
              )
            )}
            {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`main-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height:
                    openSubmenuIndex === index
                      ? `${subMenuHeight[`main-${index}`]}px`
                      : "0px",
                }}
              >
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
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
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
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
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots />}
              </h2>
              {renderMenuItems()}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
