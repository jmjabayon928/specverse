import { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

// Clients (Users Icon)
export function ClientsIcon(props: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

// Categories (Layers Icon)
export function DepartmentsIcon(props: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM7 10h10v4H7v-4z" />
    </svg>
  );
}

// Data Sheets (File Spreadsheet Icon)
export function ProjectsIcon(props: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 4h16v2H4V4zm0 4h10v2H4V8zm0 4h16v2H4v-2zm0 4h10v2H4v-2z" />
    </svg>
  );
}

// Reports (Bar Chart Icon)
export function DataSheetsIcon(props: IconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 4h18v2H3V4zm0 4h12v2H3V8zm0 4h18v2H3v-2zm0 4h12v2H3v-2z" />
    </svg>
  );
}

export function InventoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 4h16v2H4V4zm0 4h10v2H4V8zm0 4h16v2H4v-2zm0 4h10v2H4v-2z" />
    </svg>
  );
}
  
export function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9 2h6c.55 0 1 .45 1 1v1h3c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3V3c0-.55.45-1 1-1zm6 2h-6v1h6V4zM5 8v12h14V8H5zm2 3h5v2H7v-2zm0 4h5v2H7v-2zm7.5-4.25L17 14l3.5-4.25-1.41-1.41L17 10.17l-1.09-1.09-1.41 1.42z" />
    </svg>
  );
}