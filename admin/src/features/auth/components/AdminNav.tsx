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
  PackageOpen,
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
      { href: '/cargo-owners', label: 'Cargo owners', icon: PackageOpen },
      { href: '/users', label: 'Users', icon: UserRoundCog },
      { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/metrics': 'Metrics',
  '/verifications': 'Verifications',
  '/drivers': 'Drivers',
  '/cargo-owners': 'Cargo owners',
  '/users': 'Users',
  '/jobs': 'Jobs',
};

// Resolve a title for a path, falling back to the top-level section for detail
// routes like /users/<id> (which have no exact entry).
function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const top = `/${pathname.split('/')[1] ?? ''}`;
  return PAGE_TITLES[top] ?? 'Dashboard';
}

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
                  <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
                    L
                  </span>
                  <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">Loop Admin</span>
                    <span className="truncate text-xs text-muted-foreground">
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
          <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs text-muted-foreground">
              {user?.email ?? 'Admin'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            title="Sign out"
            className="justify-start group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
          >
            <LogOut />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
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
                  <BreadcrumbPage>{pageTitle(pathname)}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="truncate text-lg font-semibold">
              {pageTitle(pathname)}
            </h1>
          </div>
          <Badge variant="outline">Admin</Badge>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
