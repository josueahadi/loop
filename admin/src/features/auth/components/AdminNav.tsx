'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  LogOut,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react';
import { logout } from '../api/auth.api';
import { useSession } from '../hooks/useSession';
import { clearTokens, getRefreshToken } from '@/lib/auth';
import { useMetrics } from '@/features/metrics/hooks/useMetrics';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';

const LINK_GROUPS = [
  {
    label: 'Evaluation',
    links: [{ href: '/metrics', label: 'Metrics', icon: BarChart3 }],
  },
  {
    label: 'Operations',
    links: [
      { href: '/verifications', label: 'Verifications', icon: ClipboardCheck },
      { href: '/drivers', label: 'Drivers', icon: Users },
      { href: '/users', label: 'Users', icon: UserRoundCog },
      { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/metrics': 'Metrics',
  '/verifications': 'Verifications',
  '/drivers': 'Drivers',
  '/users': 'Users',
  '/jobs': 'Jobs',
};

export function AdminNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: metrics } = useMetrics();
  const pendingVerifications =
    metrics?.operational_counts.pending_verifications ?? 0;

  async function onLogout() {
    const rt = getRefreshToken();
    if (rt) await logout(rt).catch(() => undefined);
    clearTokens();
    qc.clear();
    router.replace('/login');
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Loop Admin">
                <Link href="/metrics">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <ShieldCheck />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">Loop Admin</span>
                    <span className="text-xs text-muted-foreground">
                      Operations console
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {LINK_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const showPending =
                      link.href === '/verifications' &&
                      pendingVerifications > 0;
                    return (
                      <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === link.href}
                          tooltip={link.label}
                        >
                          <Link href={link.href}>
                            <Icon />
                            <span>{link.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {showPending && (
                          <SidebarMenuBadge>
                            {pendingVerifications}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="truncate text-xs text-muted-foreground">
              {user?.email ?? 'Admin'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut />
            Sign out
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-1 flex-col">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>Admin</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {PAGE_TITLES[pathname] ?? 'Dashboard'}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="truncate text-lg font-semibold">
              {PAGE_TITLES[pathname] ?? 'Dashboard'}
            </h1>
          </div>
          <Badge variant="outline">MVP admin</Badge>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
