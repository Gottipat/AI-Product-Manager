'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { projectsApi, Project } from '@/lib/api';

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', googleMeetLink: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const res = await projectsApi.list();
            setProjects(res.projects);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await projectsApi.create({
                name: newProject.name,
                googleMeetLink: newProject.googleMeetLink || undefined,
                isRecurring: !!newProject.googleMeetLink,
            });
            setShowModal(false);
            setNewProject({ name: '', googleMeetLink: '' });
            loadProjects();
        } catch (err) {
            console.error('Failed to create project:', err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Projects</h1>
                    <p className="text-gray-400 mt-1">Manage your meeting projects and insights</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Project
                </button>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                </div>
            ) : projects.length === 0 ? (
                /* Empty State */
                <div className="text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
                    <p className="text-gray-400 mb-6">Create your first project to start tracking meetings</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition"
                    >
                        Create Project
                    </button>
                </div>
            ) : (
                /* Project Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-2xl p-6 transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                {project.isRecurring && (
                                    <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400">
                                        Recurring
                                    </span>
                                )}
                            </div>

                            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition">
                                {project.name}
                            </h3>

                            {project.description && (
                                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{project.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>{project.meetingCount || 0} meetings</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <span>{project.taskCount || 0} tasks</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>

                        <form onSubmit={handleCreate} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Sprint Planning, Daily Standup..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Google Meet Link <span className="text-gray-500">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={newProject.googleMeetLink}
                                    onChange={(e) => setNewProject({ ...newProject, googleMeetLink: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="https://meet.google.com/abc-defg-hij"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    If this is a recurring meeting, paste the same link to group all sessions together.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition"
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
