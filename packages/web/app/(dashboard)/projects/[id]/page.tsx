'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsApi, Project, Meeting, MeetingItem, ProjectStats } from '@/lib/api';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TaskList } from '@/components/projects/TaskList';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [items, setItems] = useState<MeetingItem[]>([]);
    const [stats, setStats] = useState<ProjectStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'action_item' | 'decision' | 'blocker'>('all');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [meetingLink, setMeetingLink] = useState('');

    useEffect(() => {
        loadProject();
    }, [projectId]);

    const loadProject = async () => {
        try {
            const res = await projectsApi.get(projectId);
            setProject(res.project);
            setMeetings(res.meetings);
            setItems(res.items);
            setStats(res.stats);
        } catch (err) {
            console.error('Failed to load project:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLink = async () => {
        if (!meetingLink) return;
        try {
            await projectsApi.updateLink(projectId, meetingLink);
            setShowLinkModal(false);
            loadProject();
        } catch (err) {
            console.error('Failed to add link:', err);
        }
    };

    const filteredItems = activeTab === 'all'
        ? items
        : items.filter(item => item.itemType === activeTab);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl text-white mb-4">Project not found</h2>
                <Link href="/projects" className="text-purple-400 hover:text-purple-300">
                    Back to projects
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/projects" className="text-gray-400 hover:text-white transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-white">{project.name}</h1>
                        {project.isRecurring && (
                            <span className="px-3 py-1 text-sm rounded-full bg-purple-500/20 text-purple-400">
                                Recurring
                            </span>
                        )}
                    </div>
                    {project.description && (
                        <p className="text-gray-400">{project.description}</p>
                    )}
                </div>

                {!project.googleMeetLink && (
                    <button
                        onClick={() => setShowLinkModal(true)}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Add Meeting Link
                    </button>
                )}
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-3xl font-bold text-white mb-1">{stats.totalMeetings}</p>
                        <p className="text-gray-400 text-sm">Meetings</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-3xl font-bold text-white mb-1">{stats.totalItems}</p>
                        <p className="text-gray-400 text-sm">Total Items</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-3xl font-bold text-yellow-400 mb-1">{stats.pendingItems}</p>
                        <p className="text-gray-400 text-sm">Pending</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-3xl font-bold text-green-400 mb-1">{stats.completedItems}</p>
                        <p className="text-gray-400 text-sm">Completed</p>
                    </div>
                </div>
            )}

            {/* Meeting Link Display */}
            {project.googleMeetLink && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-4 mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Google Meet Link</p>
                            <a
                                href={project.googleMeetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 transition"
                            >
                                {project.googleMeetLink}
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tasks Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Items & Tasks</h2>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {(['all', 'action_item', 'decision', 'blocker'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === tab
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {tab === 'all' ? 'All' : tab === 'action_item' ? 'Actions' : tab === 'decision' ? 'Decisions' : 'Blockers'}
                            </button>
                        ))}
                    </div>

                    <TaskList items={filteredItems} />
                </div>

                {/* Chat Section */}
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4">Ask AI</h2>
                    <ChatInterface projectId={projectId} />
                </div>
            </div>

            {/* Add Link Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">Add Meeting Link</h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Google Meet Link
                                </label>
                                <input
                                    type="url"
                                    value={meetingLink}
                                    onChange={(e) => setMeetingLink(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="https://meet.google.com/abc-defg-hij"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLinkModal(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddLink}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition"
                                >
                                    Add Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
