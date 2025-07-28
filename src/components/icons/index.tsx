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
export function TemplatesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3V5zm0 6h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8zm4 2v2h2v-2H7zm0 3v2h2v-2H7z" />
    </svg>
  );
}

// Reports (Bar Chart Icon)
export function DataSheetsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 2a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 13h8v2H8v-2zm0 4h5v2H8v-2z" />
    </svg>
  );
}

export function InventoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 6h-8V4h8v2zM4 4h6v2H4V4zm0 4h16v12H4V8zm2 2v8h12v-8H6z" />
    </svg>
  );
}
  
export function EstimationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H5zm0 2h14v4H5V4zm2 6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 14h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
    </svg>
  );
}

export function AdministrationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c-.6 0-1 .4-1 1v2.1c-1.2.2-2.2.8-3 1.6L6.2 5.7a1 1 0 0 0-1.4 0L3.6 6.9a1 1 0 0 0 0 1.4L5.3 10c-.8.8-1.4 1.8-1.6 3H2c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h1.7c.2 1.2.8 2.2 1.6 3l-1.7 1.7a1 1 0 0 0 0 1.4l1.1 1.1a1 1 0 0 0 1.4 0l1.7-1.7c.8.8 1.8 1.4 3 1.6V22c0 .6.4 1 1 1h2c.6 0 1-.4 1-1v-1.7c1.2-.2 2.2-.8 3-1.6l1.7 1.7a1 1 0 0 0 1.4 0l1.1-1.1a1 1 0 0 0 0-1.4l-1.7-1.7c.8-.8 1.4-1.8 1.6-3H22c.6 0 1-.4 1-1v-2c0-.6-.4-1-1-1h-1.7c-.2-1.2-.8-2.2-1.6-3l1.7-1.7a1 1 0 0 0 0-1.4l-1.1-1.1a1 1 0 0 0-1.4 0l-1.7 1.7c-.8-.8-1.8-1.4-3-1.6V3c0-.6-.4-1-1-1h-2zm1 14h-2v-2h2v2zm0-4h-2V9h2v3z" />
    </svg>
  );
}

export function ReportsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 22a1 1 0 0 1-1-1V10a1 1 0 0 1 2 0v11a1 1 0 0 1-1 1zm7 0a1 1 0 0 1-1-1V4a1 1 0 0 1 2 0v17a1 1 0 0 1-1 1zm7 0a1 1 0 0 1-1-1v-7a1 1 0 0 1 2 0v7a1 1 0 0 1-1 1z" />
    </svg>
  );
}

export function AnalyticsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 20a1 1 0 0 1-1-1v-4a1 1 0 0 1 2 0v4a1 1 0 0 1-1 1zm5-2a1 1 0 0 1-1-1v-8a1 1 0 0 1 2 0v8a1 1 0 0 1-1 1zm5 2a1 1 0 0 1-1-1v-11a1 1 0 0 1 2 0v11a1 1 0 0 1-1 1zm5-4a1 1 0 0 1-1-1v-6a1 1 0 0 1 2 0v6a1 1 0 0 1-1 1z" />
    </svg>
  );
}
