'use client';

import { MeetingItem } from '@/lib/api';

interface TaskListProps {
    items: MeetingItem[];
}

const itemTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
    action_item: { icon: '✅', color: 'bg-green-500/20 text-green-400', label: 'Action Item' },
    decision: { icon: '⚖️', color: 'bg-blue-500/20 text-blue-400', label: 'Decision' },
    blocker: { icon: '🚫', color: 'bg-red-500/20 text-red-400', label: 'Blocker' },
    risk: { icon: '⚠️', color: 'bg-orange-500/20 text-orange-400', label: 'Risk' },
    idea: { icon: '💡', color: 'bg-yellow-500/20 text-yellow-400', label: 'Idea' },
    question: { icon: '❓', color: 'bg-purple-500/20 text-purple-400', label: 'Question' },
    announcement: { icon: '📢', color: 'bg-indigo-500/20 text-indigo-400', label: 'Announcement' },
    project_update: { icon: '📊', color: 'bg-cyan-500/20 text-cyan-400', label: 'Update' },
    commitment: { icon: '🤝', color: 'bg-pink-500/20 text-pink-400', label: 'Commitment' },
    deadline: { icon: '📅', color: 'bg-rose-500/20 text-rose-400', label: 'Deadline' },
    dependency: { icon: '🔗', color: 'bg-amber-500/20 text-amber-400', label: 'Dependency' },
    parking_lot: { icon: '🅿️', color: 'bg-slate-500/20 text-slate-400', label: 'Parking Lot' },
    key_takeaway: { icon: '🔑', color: 'bg-emerald-500/20 text-emerald-400', label: 'Key Takeaway' },
    reference: { icon: '📎', color: 'bg-violet-500/20 text-violet-400', label: 'Reference' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Pending' },
    in_progress: { color: 'bg-blue-500/20 text-blue-400', label: 'In Progress' },
    completed: { color: 'bg-green-500/20 text-green-400', label: 'Completed' },
    blocked: { color: 'bg-red-500/20 text-red-400', label: 'Blocked' },
    deferred: { color: 'bg-gray-500/20 text-gray-400', label: 'Deferred' },
    cancelled: { color: 'bg-slate-500/20 text-slate-400', label: 'Cancelled' },
};

const priorityConfig: Record<string, { color: string }> = {
    critical: { color: 'border-red-500' },
    high: { color: 'border-orange-500' },
    medium: { color: 'border-yellow-500' },
    low: { color: 'border-gray-500' },
};

export function TaskList({ items }: TaskListProps) {
    if (items.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <p className="text-gray-400">No items yet. Join a meeting to capture action items.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((item) => {
                const typeInfo = itemTypeConfig[item.itemType] || itemTypeConfig.action_item;
                const statusInfo = statusConfig[item.status] || statusConfig.pending;
                const priorityInfo = priorityConfig[item.priority || 'medium'];

                return (
                    <div
                        key={item.id}
                        className={`bg-white/5 hover:bg-white/10 border-l-4 ${priorityInfo.color} rounded-lg p-4 transition-all group`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${typeInfo.color}`}>
                                        {typeInfo.icon} {typeInfo.label}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                </div>

                                <h4 className="text-white font-medium mb-1 group-hover:text-purple-400 transition">
                                    {item.title}
                                </h4>

                                {item.description && (
                                    <p className="text-gray-400 text-sm line-clamp-2">{item.description}</p>
                                )}

                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                    {item.assignee && (
                                        <div className="flex items-center gap-1">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-medium">
                                                {item.assignee.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{item.assignee}</span>
                                        </div>
                                    )}
                                    {item.dueDate && (
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>{new Date(item.dueDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
