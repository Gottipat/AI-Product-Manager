'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authApi, User } from '@/lib/api';

const navItems = [
  {
    label: 'Projects',
    href: '/projects',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Meetings',
    href: '/meetings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => router.push('/signin'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await authApi.logout();
    router.push('/signin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] flex">
      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col border-r border-white/[0.06] bg-[#0F1219] transition-all duration-200 ${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          {!sidebarCollapsed && <span className="text-lg font-semibold text-white tracking-tight">Meeting AI</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
                }`}
              >
                <span className={isActive ? 'text-purple-400' : ''}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="mx-3 mb-2 p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition"
        >
          <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* User */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{user?.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/[0.06] transition"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className={`flex-1 transition-all duration-200 ${sidebarCollapsed ? 'ml-[68px]' : 'ml-[240px]'}`}>
        {/* Top Bar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#0B0E14]/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-8">
          <Breadcrumbs pathname={pathname} />
        </header>

        {/* Page Content */}
        <main className="px-8 py-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}

/* ── Breadcrumbs ── */
function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: { label: string; href?: string }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const href = '/' + segments.slice(0, i + 1).join('/');

    if (seg === 'projects') {
      crumbs.push({ label: 'Projects', href });
    } else if (seg === 'meetings' && i === 0) {
      crumbs.push({ label: 'Meetings', href });
    } else if (i > 0 && segments[i - 1] === 'projects') {
      // Project ID — show as "Project"
      crumbs.push({ label: 'Project Detail', href });
    } else if (i > 0 && segments[i - 1] === 'meetings') {
      crumbs.push({ label: 'Meeting Detail' });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {crumbs.map((crumb, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && (
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {crumb.href && i < crumbs.length - 1 ? (
            <Link href={crumb.href} className="text-gray-400 hover:text-white transition">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-300 font-medium">{crumb.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
