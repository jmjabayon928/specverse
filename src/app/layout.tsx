// src/app/layout.tsx
import { Outfit } from "next/font/google";
import "./globals.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import LayoutWithSidebar from "@/layout/LayoutWithSidebar";
import SessionDebug from "@/components/debug/SessionDebug";

const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>
            <LayoutWithSidebar>{children}</LayoutWithSidebar>
            <Toaster
              position="top-right"
              toastOptions={{
                className: "z-[9999]", 
              }}
            />
            <SessionDebug />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
