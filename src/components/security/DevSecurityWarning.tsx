'use client';

import { DEV_SECURITY_CHECKS_ENABLED } from '@/config/devconfig';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DevSecurityWarning() {
  const pathname = usePathname();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!DEV_SECURITY_CHECKS_ENABLED) return;

    // Delay check longer to ensure <SecurePage /> runs first
    const timeout = setTimeout(() => {
      const isSecure = typeof window !== 'undefined' && window.__SECURE_PAGE_PRESENT__;
      if (!isSecure) {
        console.warn(`⚠️ DEV WARNING: Page ${pathname} is missing <SecurePage />`);
        setMissing(true);
      }
    }, 200); // <-- increased delay to ensure SecurePage runs

    return () => clearTimeout(timeout);
  }, [pathname]);

  if (!missing) return null;

  return (
    <div className="bg-red-600 text-white text-center p-2 text-sm font-semibold">
      ⚠️ DEV WARNING: This page is NOT using &lt;SecurePage /&gt;. Add it to enforce frontend access control.
    </div>
  );
}
