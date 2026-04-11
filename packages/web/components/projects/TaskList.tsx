'use client';

import { MeetingItem } from '@/lib/api';

interface TaskListProps {
  items: MeetingItem[];
}

const itemTypeConfig: Record<string, { color: string; label: string }> = {
  action_item: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Action' },
  decision: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Decision' },
  blocker: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Blocker' },
  risk: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Risk' },
  idea: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'Idea' },
  question: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Question' },
  announcement: { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'Announce' },
  project_update: { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', label: 'Update' },
  commitment: { color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', label: 'Commit' },
  deadline: { color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', label: 'Deadline' },
  dependency: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Dependency' },
  parking_lot: { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: 'Parked' },
  key_takeaway: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Takeaway' },
  reference: { color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', label: 'Reference' },
};

export function TaskList({ items }: TaskListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white/[0.02] border border-white/[0.06] rounded-lg">
        <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No items yet. Upload a transcript or join a meeting to extract items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const typeInfo = itemTypeConfig[item.itemType] || { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: item.itemType };

        return (
          <div
            key={item.id}
            className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 hover:bg-white/[0.05] transition"
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 px-2 py-0.5 text-[11px] rounded-md border flex-shrink-0 ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-white text-sm font-medium">{item.title}</h4>
                {item.description && (
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  {item.assignee && (
                    <span className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-[9px] font-bold">
                        {item.assignee.charAt(0).toUpperCase()}
                      </div>
                      {item.assignee}
                    </span>
                  )}
                  {item.dueDate && (
                    <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                  )}
                  {item.priority && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      item.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                      item.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                      item.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>{item.priority}</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    item.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    item.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-white/[0.04] text-gray-500'
                  }`}>{item.status}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
