import { AdminGate } from '@/features/auth/components/AdminGate';
import { AdminNav } from '@/features/auth/components/AdminNav';

// Every route under (dashboard) is admin-gated and framed with the nav.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGate>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </AdminGate>
  );
}
