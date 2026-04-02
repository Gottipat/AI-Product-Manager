'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ChatInterface } from '@/components/chat/ChatInterface';
import { MoMDisplay } from '@/components/mom/MoMDisplay';
import { TaskList } from '@/components/projects/TaskList';
import { TranscriptUpload } from '@/components/transcript/TranscriptUpload';
import { projectsApi, botApi, Project, Meeting, MeetingItem, MoM, ProjectStats } from '@/lib/api';

export default function ProjectDetailPage() {
  const params = useParams();

  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [moms, setMoms] = useState<Record<string, MoM>>({});
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'action_item' | 'decision' | 'blocker'>('all');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');

  // Bot state
  const [botSessionId, setBotSessionId] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<string>('idle');
  const [botStarting, setBotStarting] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

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
      loadProject();
    } catch (err) {
      console.error('Failed to add link:', err);
    }
  };

  // Bot handlers
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

  // Poll bot status
  useEffect(() => {
    if (!botSessionId || ['stopped', 'error', 'idle'].includes(botStatus)) return;

    const interval = setInterval(async () => {
      try {
        const res = await botApi.status(botSessionId);
        setBotStatus(res.status);
        if (['stopped', 'error'].includes(res.status)) {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [botSessionId, botStatus]);

  // Live Dashboard Polling (Firebase-style seamless sync)
  useEffect(() => {
    const hasActiveMeeting = meetings.some(m => ['bot_joining', 'in_progress'].includes(m.status));
    const isBotActive = !['stopped', 'error', 'idle'].includes(botStatus);
    
    // Only poll if there's an active capture happening from extension or bot
    if (!hasActiveMeeting && !isBotActive) return;

    const interval = setInterval(() => {
      // Silently fetches latest transcripts, items, and MoMs from DB
      projectsApi.get(projectId).then(res => {
        setProject(res.project);
        setMeetings(res.meetings);
        setItems(res.items);
        setMoms(res.moms || {});
        setStats(res.stats);
      }).catch(err => console.error('Silent poll failed:', err));
    }, 3000);

    return () => clearInterval(interval);
  }, [meetings, botStatus, projectId]);

  const filteredItems =
    activeTab === 'all' ? items : items.filter((item) => item.itemType === activeTab);

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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
            {project.isRecurring && (
              <span className="px-3 py-1 text-sm rounded-full bg-purple-500/20 text-purple-400">
                Recurring
              </span>
            )}
          </div>
          {project.description && <p className="text-gray-400">{project.description}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Upload Transcript Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 transition flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Transcript
          </button>

          {!project.googleMeetLink && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Add Meeting Link
            </button>
          )}
        </div>
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

      {/* Meeting Link + Capture Options */}
      {project.googleMeetLink && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">

            {/* Left: Meeting Info */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Meeting Link
              </h3>
              <a
                href={project.googleMeetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition text-lg block mb-2 break-all"
              >
                {project.googleMeetLink}
              </a>
              <p className="text-sm text-gray-400">
                Join this link to start your meeting. You can capture transcripts using either the AI Bot or the Chrome Extension.
              </p>
            </div>

            {/* Right: Capture Modes */}
            <div className="flex-1 space-y-4">

              {/* Option 1: Bot (Server-side) */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    Option 1: AI Bot (Cloud)
                  </h4>
                  {botStatus !== 'idle' && botStatus !== 'stopped' && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${botStatus === 'in_meeting'
                          ? 'bg-green-400 animate-pulse'
                          : botStatus === 'error'
                            ? 'bg-red-400'
                            : 'bg-yellow-400 animate-pulse'
                          }`}
                      />
                      <span className="text-sm text-gray-300 capitalize">{botStatus.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4 h-8">
                  Sends an invisible bot to join the meeting. Works best if you are the host and can admit it.
                </p>
                <div className="flex justify-end">
                  {botStatus === 'idle' || botStatus === 'stopped' || botStatus === 'error' ? (
                    <button
                      onClick={handleStartBot}
                      disabled={botStarting}
                      className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 disabled:opacity-50 transition flex items-center gap-2"
                    >
                      {botStarting ? 'Starting...' : botStatus === 'error' ? 'Retry Bot' : 'Join with Bot'}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopBot}
                      className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/30 transition flex items-center gap-2"
                    >
                      Stop Bot
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Chrome Extension (Client-side) */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4">
                <h4 className="text-white font-medium flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Option 2: Browser Extension
                </h4>
                <p className="text-xs text-gray-400 mb-4 h-8">
                  Capture directly from your tab. Use this if the bot is blocked by organization settings.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 rounded">No admit required</span>
                  <button
                    onClick={() => {
                      alert('To use the extension:\n1. Open the meeting link\n2. Click the Meeting AI extension icon in Chrome\n3. Select this project from the dropdown\n4. Click "Start Capture"');
                    }}
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition"
                  >
                    How to use
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MoM Section */}
      {Object.keys(moms).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Minutes of Meeting
          </h2>
          <MoMDisplay moms={moms} meetings={meetings} />
        </div>
      )}

      {/* Captured Meetings (Transcripts) */}
      <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                 <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
                 Captured Meetings
              </h2>
              <Link href="/meetings" className="text-sm text-indigo-400 hover:text-indigo-300">View All History</Link>
          </div>
          {meetings.length === 0 ? (
              <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/10 text-gray-400">
                  No meetings captured for this project yet. Use the extension or bot to start capturing.
              </div>
          ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                      <thead>
                          <tr className="border-b border-white/10 text-gray-400 text-left">
                              <th className="px-4 py-3 font-medium w-16">S.No</th>
                              <th className="px-4 py-3 font-medium">Meeting</th>
                              <th className="px-4 py-3 font-medium w-24 text-center">Status</th>
                              <th className="px-4 py-3 font-medium w-28 text-center">Transcript</th>
                              <th className="px-4 py-3 font-medium w-24 text-center">Audio</th>
                              <th className="px-4 py-3 font-medium w-28 text-center">Date</th>
                              <th className="px-4 py-3 font-medium w-20"></th>
                          </tr>
                      </thead>
                      <tbody>
                          {meetings.map((meeting, index) => (
                              <tr key={meeting.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                  <td className="px-4 py-3 text-gray-400 font-mono">{index + 1}</td>
                                  <td className="px-4 py-3">
                                      <Link href={`/meetings/${meeting.id}`} className="text-white hover:text-purple-300 font-medium transition line-clamp-1">
                                          {meeting.title}
                                      </Link>
                                      {meeting.durationMinutes && (
                                          <span className="text-gray-500 text-xs ml-2">{meeting.durationMinutes} min</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1.5 ${
                                          meeting.status === 'in_progress'
                                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                              : meeting.status === 'completed'
                                              ? 'bg-white/10 text-gray-300'
                                              : 'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                          {meeting.status === 'in_progress' && (
                                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                          )}
                                          {meeting.status === 'in_progress' ? 'Live' : meeting.status}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      <Link href={`/meetings/${meeting.id}`} className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition text-xs font-medium">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                          </svg>
                                          {meeting.totalTranscriptEvents || 0} events
                                      </Link>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      {meeting.status === 'completed' ? (
                                          <Link href={`/meetings/${meeting.id}`} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition text-xs font-medium">
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a6.978 6.978 0 00-2.828 2.828M17.657 6.343a8 8 0 010 11.314" />
                                              </svg>
                                              Play
                                          </Link>
                                      ) : meeting.status === 'in_progress' ? (
                                          <span className="text-xs text-gray-500">Recording...</span>
                                      ) : (
                                          <span className="text-xs text-gray-600">—</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                      {new Date(meeting.startTime || meeting.createdAt || '').toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <Link
                                          href={`/meetings/${meeting.id}`}
                                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium hover:bg-purple-500/30 transition"
                                      >
                                          View
                                      </Link>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

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
                {tab === 'all'
                  ? 'All'
                  : tab === 'action_item'
                    ? 'Actions'
                    : tab === 'decision'
                      ? 'Decisions'
                      : 'Blockers'}
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
