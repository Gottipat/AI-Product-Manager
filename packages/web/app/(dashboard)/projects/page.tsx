'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { projectsApi, Project } from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [newProject, setNewProject] = useState({ name: '', description: '', googleMeetLink: '' });
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
        description: newProject.description || undefined,
        googleMeetLink: newProject.googleMeetLink || undefined,
        isRecurring: !!newProject.googleMeetLink,
      });
      setShowModal(false);
      setNewProject({ name: '', description: '', googleMeetLink: '' });
      loadProjects();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition"
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No projects yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create your first project to start tracking meetings</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition"
          >
            Create Project
          </button>
        </div>
      ) : (
        /* Project Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  {project.isRecurring && (
                    <span className="px-2 py-0.5 text-[11px] rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Recurring
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-[11px] rounded-md border ${
                    project.status === 'active'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>

              <h3 className="text-[15px] font-semibold text-white mb-1 group-hover:text-purple-300 transition">
                {project.name}
              </h3>

              {project.description && (
                <p className="text-gray-500 text-sm mb-3 line-clamp-2">{project.description}</p>
              )}

              <div className="flex items-center gap-4 pt-3 border-t border-white/[0.04] text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {project.meetingCount || 0} meetings
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {project.taskCount || 0} items
                </span>
                <span className="ml-auto">{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-12 text-gray-500 text-sm">
              No projects match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#161B26] border border-white/[0.08] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-5">Create New Project</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition"
                  placeholder="Sprint Planning, Daily Standup..."
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Description <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition"
                  placeholder="Weekly team sync for sprint progress"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Google Meet Link <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="url"
                  value={newProject.googleMeetLink}
                  onChange={(e) => setNewProject({ ...newProject, googleMeetLink: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition"
                  placeholder="https://meet.google.com/abc-defg-hij"
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  For recurring meetings, paste the same link to group sessions together.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-white/[0.06] text-gray-300 text-sm font-medium hover:bg-white/[0.1] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
