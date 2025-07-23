'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

interface SecurePageProps {
  requiredPermission: string;
  children: React.ReactNode;
}

export default function SecurePage({ requiredPermission, children }: SecurePageProps) {
  const { user, loading } = useSession();
  const router = useRouter();

  // Mark this page as secure in global scope for diagnostics
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SECURE_PAGE_PRESENT__ = false;
    }
  }, []);

  // Permission check
  useEffect(() => {
    if (!loading && user) {
      const hasPermission = user.permissions.includes(requiredPermission);
      if (!hasPermission) {
        if (user.role !== 'Admin') {
          router.push('/unauthorized');
        } else {
          console.warn(`⚠️ Admin missing permission '${requiredPermission}' on frontend route. Proceeding due to Admin override.`);
        }
      }
    }
  }, [user, loading, requiredPermission, router]);

  return <>{children}</>;
}