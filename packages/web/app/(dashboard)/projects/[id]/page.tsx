'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { ItemsWorkspace } from '@/components/items/ItemsWorkspace';
import { TranscriptUpload } from '@/components/transcript/TranscriptUpload';
import {
  botApi,
  meetingItemsApi,
  Meeting,
  MeetingItem,
  MeetingItemStatus,
  MeetingItemUpdateInput,
  MoM,
  Project,
  ProjectStats,
  projectsApi,
} from '@/lib/api';

function buildProjectStats(items: MeetingItem[], meetingsCount: number): ProjectStats {
  return {
    totalMeetings: meetingsCount,
    totalItems: items.length,
    pendingItems: items.filter((item) => item.status === 'pending').length,
    completedItems: items.filter((item) => item.status === 'completed').length,
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [moms, setMoms] = useState<Record<string, MoM>>({});
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'chat'>('overview');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');

  // Bot state
  const [botSessionId, setBotSessionId] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<string>('idle');
  const [botStarting, setBotStarting] = useState(false);

  useEffect(() => { loadProject(); }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await projectsApi.get(projectId);
      setProject(res.project);
      setMeetings(res.meetings);
      setItems(res.items);
      setMoms(res.moms || {});
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
      setMeetingLink('');
      loadProject();
    } catch (err) {
      console.error('Failed to add link:', err);
    }
  };

  const handleStartBot = async () => {
    if (!project?.googleMeetLink) return;
    setBotStarting(true);
    try {
      const res = await botApi.join(project.googleMeetLink, project.name);
      setBotSessionId(res.sessionId);
      setBotStatus('starting');
    } catch (err) {
      console.error('Failed to start bot:', err);
      setBotStatus('error');
    } finally {
      setBotStarting(false);
    }
  };

  const handleStopBot = async () => {
    if (!botSessionId) return;
    try {
      await botApi.stop(botSessionId);
      setBotStatus('stopped');
      setBotSessionId(null);
    } catch (err) {
      console.error('Failed to stop bot:', err);
    }
  };

  useEffect(() => {
    if (!botSessionId || ['stopped', 'error', 'idle'].includes(botStatus)) return;
    const interval = setInterval(async () => {
      try {
        const res = await botApi.status(botSessionId);
        setBotStatus(res.status);
        if (['stopped', 'error'].includes(res.status)) clearInterval(interval);
      } catch { clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [botSessionId, botStatus]);

  const meetingsById = meetings.reduce<Record<string, Meeting>>((accumulator, meeting) => {
    accumulator[meeting.id] = meeting;
    return accumulator;
  }, {});

  const handleItemStatusChange = async (itemId: string, status: MeetingItemStatus) => {
    const response = await meetingItemsApi.updateStatus(itemId, status, 'project_workspace');
    const updatedItem = response.item;

    setItems((current) => {
      const nextItems = current.map((item) => (item.id === itemId ? { ...item, ...updatedItem } : item));
      setStats(buildProjectStats(nextItems, meetings.length));
      return nextItems;
    });
  };

  const handleItemUpdate = async (itemId: string, updates: MeetingItemUpdateInput) => {
    const response = await meetingItemsApi.update(itemId, updates);
    const updatedItem = response.item;

    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...updatedItem } : item))
    );
  };

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
        <Link href="/projects" className="text-purple-400 hover:text-purple-300 text-sm">Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && <p className="text-gray-500 text-sm mt-1">{project.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-600/20 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Transcript
          </button>

          {!project.googleMeetLink && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-3.5 py-2 rounded-lg bg-white/[0.06] text-gray-300 text-sm font-medium hover:bg-white/[0.1] transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Add Meet Link
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Meetings', value: stats.totalMeetings, color: 'text-white' },
            { label: 'Total Items', value: stats.totalItems, color: 'text-white' },
            { label: 'Pending', value: stats.pendingItems, color: 'text-yellow-400' },
            { label: 'Completed', value: stats.completedItems, color: 'text-green-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Capture Options (if link exists) */}
      {project.googleMeetLink && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-300 font-medium">Meeting Link</p>
                <a href={project.googleMeetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 transition break-all">
                  {project.googleMeetLink}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {botStatus !== 'idle' && botStatus !== 'stopped' && botStatus !== 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400 mr-2">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${botStatus === 'in_meeting' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  {botStatus.replace('_', ' ')}
                </span>
              )}
              {botStatus === 'idle' || botStatus === 'stopped' || botStatus === 'error' ? (
                <button
                  onClick={handleStartBot}
                  disabled={botStarting}
                  className="px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {botStarting ? 'Starting...' : 'Join with Bot'}
                </button>
              ) : (
                <button
                  onClick={handleStopBot}
                  className="px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition"
                >
                  Stop Bot
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-6">
        {([
          { key: 'overview' as const, label: 'Meetings' },
          { key: 'items' as const, label: 'Action Items', count: items.length },
          { key: 'chat' as const, label: 'Ask AI' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
              activeTab === tab.key
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                activeTab === tab.key ? 'bg-purple-500/20 text-purple-400' : 'bg-white/[0.06] text-gray-500'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Meetings Tab ── */}
      {activeTab === 'overview' && (
        <div>
          {meetings.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-white mb-1">No meetings yet</h3>
              <p className="text-gray-500 text-sm">Upload a transcript or use the bot to capture your first meeting.</p>
            </div>
          ) : (
            <div className="border border-white/[0.06] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-10">#</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Meeting</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-24">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-24">Segments</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-20">MoM</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 w-36">Date</th>
                    <th className="w-16 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting, i) => {
                    const hasMom = !!moms[meeting.id];
                    return (
                      <tr key={meeting.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition group">
                        <td className="px-4 py-3 text-xs text-gray-600">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link href={`/meetings/${meeting.id}`} className="text-sm text-white font-medium hover:text-purple-400 transition">
                            {meeting.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {meeting.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              Live
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 capitalize">{meeting.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{meeting.totalTranscriptEvents || 0}</td>
                        <td className="px-4 py-3">
                          {hasMom ? (
                            <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {meeting.startTime ? new Date(meeting.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/meetings/${meeting.id}`}
                            className="opacity-0 group-hover:opacity-100 text-xs text-purple-400 hover:text-purple-300 transition"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Items Tab ── */}
      {activeTab === 'items' && (
        <ItemsWorkspace
          items={items}
          meetingsById={meetingsById}
          workspaceKey={`project:${projectId}`}
          emptyMessage="No items yet. Upload a transcript or join a meeting to extract action items, blockers, decisions, and follow-ups."
          onStatusChange={handleItemStatusChange}
          onItemUpdate={handleItemUpdate}
        />
      )}

      {/* ── Chat Tab ── */}
      {activeTab === 'chat' && (
        <ChatInterface projectId={projectId} />
      )}

      {/* Add Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#161B26] border border-white/[0.08] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-5">Add Meeting Link</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Google Meet Link</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLinkModal(false)} className="flex-1 py-2.5 rounded-lg bg-white/[0.06] text-gray-300 text-sm font-medium hover:bg-white/[0.1] transition">
                  Cancel
                </button>
                <button onClick={handleAddLink} className="flex-1 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition">
                  Add Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Transcript Modal */}
      {showUploadModal && (
        <TranscriptUpload
          projectId={projectId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={loadProject}
        />
      )}
    </div>
  );
}
