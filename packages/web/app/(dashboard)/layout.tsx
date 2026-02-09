'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, User } from '@/lib/api';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="border-b border-white/10 bg-black/20 backdrop-blur-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/projects" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                <svg
                                    className="w-5 h-5 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">Meeting AI</span>
                        </Link>

                        {/* Nav Links */}
                        <div className="flex items-center gap-6">
                            <Link
                                href="/projects"
                                className="text-gray-300 hover:text-white transition font-medium"
                            >
                                Projects
                            </Link>

                            {/* User Menu */}
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-sm text-white font-medium">{user?.displayName}</p>
                                    <p className="text-xs text-gray-400">{user?.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition text-sm"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
