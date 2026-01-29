'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

interface SecurePageProps {
  requiredPermission?: string;
  requiredRole?: string;
  children: React.ReactNode;
}

export default function SecurePage({
  requiredPermission,
  requiredRole,
  children,
}: SecurePageProps) {
  const { user, loading } = useSession();
  const router = useRouter();

  // Mark this page as secure in global scope for diagnostics
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__SECURE_PAGE_PRESENT__ = false;
    }
  }, []);

  // Role or permission check
  useEffect(() => {
    if (loading || !user) return;

    if (requiredRole != null && requiredRole !== '') {
      const userRoleLower = user.role?.toLowerCase() ?? '';
      const requiredRoleLower = requiredRole.toLowerCase();
      if (userRoleLower !== requiredRoleLower) {
        router.push('/unauthorized');
      }
      return;
    }

    if (requiredPermission != null && requiredPermission !== '') {
      const hasPermission = user.permissions.includes(requiredPermission);
      if (!hasPermission) {
        if (user.role?.toLowerCase() !== 'admin') {
          router.push('/unauthorized');
        } else {
          console.warn(
            `⚠️ Admin missing permission '${requiredPermission}' on frontend route. Proceeding due to Admin override.`
          );
        }
      }
    }
  }, [user, loading, requiredPermission, requiredRole, router]);

  return <>{children}</>;
}