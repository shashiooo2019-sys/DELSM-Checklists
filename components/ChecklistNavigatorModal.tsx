'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  DayOperationalData, 
  OperationalGroup, 
  SubOperationalGroup, 
  Checklist, 
  UserAccount 
} from '@/types/aviation';
import { isGroupComplete, isChecklistComplete } from '@/lib/storage';
import { 
  Plane, 
  Building2, 
  Sun, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Play, 
  ArrowLeft, 
  X, 
  Search, 
  ChevronRight, 
  SlidersHorizontal,
  FileText,
  ShieldAlert,
  Sparkles,
  Layers,
  Check,
  Pin,
  AlertTriangle
} from 'lucide-react';

interface ChecklistNavigatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  onSelectChecklist: (group: OperationalGroup, subGroup: SubOperationalGroup, checklist: Checklist) => void;
  initialGroupId?: string | null;
}

export function ChecklistNavigatorModal({
  isOpen,
  onClose,
  dayData,
  currentUser,
  onSelectChecklist,
  initialGroupId = null,
}: ChecklistNavigatorModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [groupFilter, setGroupFilter] = useState<'all' | 'flight' | 'terminal' | 'dayshift' | 'pending' | 'completed'>('all');
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');
  const [checklistSearchQuery, setChecklistSearchQuery] = useState<string>('');

  const handleClose = useCallback(() => {
    setSelectedGroupId(null);
    setGroupSearchQuery('');
    setChecklistSearchQuery('');
    setGroupFilter('all');
    onClose();
  }, [onClose]);

  // Keyboard shortcut handler (Escape to go back or close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedGroupId) {
          // Go back to groups view
          setSelectedGroupId(null);
        } else {
          // Close modal
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedGroupId, handleClose]);

  const groups = useMemo(() => dayData?.groups || [], [dayData]);

  // Active selected group object
  const activeGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return groups.find((g) => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  // Filtered operational groups for View 1
  const filteredGroups = useMemo(() => {
    return groups.filter((grp) => {
      const isComplete = isGroupComplete(grp);
      const isDayShift = grp.code === 'DAY-OPS' || grp.name.toLowerCase().includes('day shift');

      // Category filter
      if (groupFilter === 'flight' && !grp.isFlightGroup) return false;
      if (groupFilter === 'terminal' && (grp.isFlightGroup || isDayShift)) return false;
      if (groupFilter === 'dayshift' && !isDayShift) return false;
      if (groupFilter === 'completed' && !isComplete) return false;
      if (groupFilter === 'pending' && isComplete) return false;

      // Search query filter
      if (groupSearchQuery.trim()) {
        const q = groupSearchQuery.toLowerCase();
        const matchesName = grp.name.toLowerCase().includes(q);
        const matchesCode = grp.code.toLowerCase().includes(q);
        const matchesChecklist = grp.subGroups?.some((sub) =>
          sub.checklists?.some((chk) => chk.title.toLowerCase().includes(q))
        );
        return matchesName || matchesCode || matchesChecklist;
      }

      return true;
    });
  }, [groups, groupFilter, groupSearchQuery]);

  // All checklists for the active group in View 2
  const activeGroupChecklists = useMemo(() => {
    if (!activeGroup) return [];

    const list: {
      subGroup: SubOperationalGroup;
      checklist: Checklist;
    }[] = [];

    for (const sub of activeGroup.subGroups || []) {
      for (const chk of sub.checklists || []) {
        if (checklistSearchQuery.trim()) {
          const q = checklistSearchQuery.toLowerCase();
          const matchesTitle = chk.title.toLowerCase().includes(q);
          const matchesSub = sub.name.toLowerCase().includes(q);
          const matchesItems = chk.items?.some((it) => it.text.toLowerCase().includes(q));
          if (!matchesTitle && !matchesSub && !matchesItems) {
            continue;
          }
        }
        list.push({ subGroup: sub, checklist: chk });
      }
    }

    return list;
  }, [activeGroup, checklistSearchQuery]);

  if (!isOpen) return null;

  // Helper for group category badge
  const getGroupCategoryBadge = (grp: OperationalGroup) => {
    const isDayShift = grp.code === 'DAY-OPS' || grp.name.toLowerCase().includes('day shift');
    if (grp.isFlightGroup) {
      return {
        label: 'FLIGHT TURNAROUND',
        bg: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <Plane className="w-3.5 h-3.5 text-blue-600" />,
      };
    }
    if (isDayShift) {
      return {
        label: 'DAY SHIFT OPS',
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: <Sun className="w-3.5 h-3.5 text-amber-600" />,
      };
    }
    return {
      label: 'TERMINAL OPS',
      bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: <Building2 className="w-3.5 h-3.5 text-indigo-600" />,
    };
  };

  // Helper for checklist statistics in a group
  const getGroupStats = (grp: OperationalGroup) => {
    let totalItems = 0;
    let doneItems = 0;
    let skippedItems = 0;
    let pinnedItems = 0;
    let missedItems = 0;
    let incorrectItems = 0;
    let totalChecklists = 0;
    let completedChecklists = 0;

    for (const sub of grp.subGroups || []) {
      for (const chk of sub.checklists || []) {
        totalChecklists++;
        if (chk.status === 'completed') completedChecklists++;
        for (const item of chk.items || []) {
          totalItems++;
          if (item.status === 'done') doneItems++;
          else if (item.status === 'skipped') skippedItems++;
          else if (item.status === 'pinned') pinnedItems++;
          else if (item.status === 'missed') missedItems++;
          else if (item.status === 'incorrectly_executed') incorrectItems++;
        }
      }
    }

    const progressPercent = totalChecklists > 0 
      ? Math.round((completedChecklists / totalChecklists) * 100) 
      : 0;

    const hasIssues = missedItems > 0 || incorrectItems > 0;
    const isFullyDone = totalChecklists > 0 && completedChecklists === totalChecklists;

    return {
      totalChecklists,
      completedChecklists,
      totalItems,
      doneItems,
      skippedItems,
      pinnedItems,
      missedItems,
      incorrectItems,
      progressPercent,
      hasIssues,
      isFullyDone,
    };
  };

  return (
    <div 
      id="checklist-fullscreen-navigator-modal"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in duration-150"
    >
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3 text-white flex items-center justify-between shrink-0 shadow-lg gap-4">
        {/* Left Section: Breadcrumb & Title */}
        <div className="flex items-center gap-3 min-w-0">
          {selectedGroupId ? (
            <button
              id="btn-nav-back-to-groups"
              type="button"
              onClick={() => setSelectedGroupId(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-slate-700 transition cursor-pointer active:scale-95 shadow-xs"
              title="Return to All Operational Groups (or press Esc)"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>All Groups</span>
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md border border-blue-400/40 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                {selectedGroupId && activeGroup ? (
                  <>
                    <span className="text-slate-400 font-normal hidden sm:inline">Operational Group:</span>
                    <span className="text-blue-400 font-extrabold truncate">{activeGroup.name}</span>
                  </>
                ) : (
                  <span>Operational Checklist Navigator</span>
                )}
              </h2>
              {selectedGroupId && activeGroup && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                  {activeGroup.code}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {selectedGroupId
                ? 'Click any checklist button below to immediately start and execute its items.'
                : 'Select an operational group below to view and launch its execution checklists.'}
            </p>
          </div>
        </div>

        {/* Right Section: Actions & Close */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Shift: <strong className="text-white">{dayData.date}</strong></span>
          </div>

          <button
            id="btn-close-checklist-navigator"
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 cursor-pointer shadow-xs"
            title="Close Navigator (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* VIEW 1: Operational Groups Grid (Covering Screen) */}
      {!selectedGroupId ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-4 sm:p-6 md:p-8">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-slate-800/80 shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-navigator-group-search"
                type="text"
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                placeholder="Search operational groups or flights..."
                className="w-full bg-slate-800/90 text-white placeholder-slate-400 text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {groupSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGroupSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: 'all', label: `All Groups (${groups.length})` },
                { id: 'flight', label: 'Flight Turnaround' },
                { id: 'terminal', label: 'Terminal Ops' },
                { id: 'dayshift', label: 'Day Shift' },
                { id: 'pending', label: 'Pending' },
                { id: 'completed', label: 'Completed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGroupFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    groupFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Groups Large Responsive Grid Covering Screen */}
          <div className="flex-1 overflow-y-auto py-4 sm:py-6 pr-1 scrollbar-thin">
            {filteredGroups.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
                <AlertCircle className="w-12 h-12 text-slate-500" />
                <h3 className="text-base font-bold text-white">No Operational Groups Found</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  No groups match your current filter criteria or search query. Try clearing your search or selecting &ldquo;All Groups&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setGroupFilter('all');
                    setGroupSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredGroups.map((group) => {
                  const badge = getGroupCategoryBadge(group);
                  const stats = getGroupStats(group);

                  return (
                    <button
                      key={group.id}
                      id={`btn-navigator-group-${group.id}`}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`group relative text-left bg-gradient-to-b from-slate-800/90 to-slate-900/90 border-2 rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer flex flex-col justify-between space-y-4 select-none ${
                        group.isVerified
                          ? 'border-sky-500/80 hover:border-sky-400 ring-1 ring-sky-500/30'
                          : stats.isFullyDone
                          ? 'border-emerald-500/80 hover:border-emerald-400 ring-1 ring-emerald-500/30'
                          : stats.hasIssues
                          ? 'border-rose-500/70 hover:border-rose-400'
                          : 'border-slate-700 hover:border-blue-500'
                      }`}
                    >
                      {/* Card Top Meta */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase border ${badge.bg}`}>
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                            {group.code}
                          </span>
                        </div>

                        {/* Status Icon Indicator */}
                        {group.isVerified ? (
                          <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-600 text-[10px] font-black uppercase flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-sky-400" />
                            Verified
                          </span>
                        ) : stats.isFullyDone ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-black uppercase flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            100% Done
                          </span>
                        ) : stats.hasIssues ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 text-[10px] font-black uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Non-Compliance
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {stats.completedChecklists}/{stats.totalChecklists} Done
                          </span>
                        )}
                      </div>

                      {/* Group Name & Checklists Count */}
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-black text-white group-hover:text-blue-300 transition line-clamp-2 leading-snug">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          {stats.totalChecklists} Checklists · {stats.totalItems} Operational Tasks
                        </p>
                      </div>

                      {/* Progress Bar & Percentage */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400 font-bold">Execution Progress</span>
                          <span className={`font-black ${
                            stats.isFullyDone ? 'text-emerald-400' : 'text-blue-400'
                          }`}>
                            {stats.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-300 ${
                              stats.isFullyDone
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            }`}
                            style={{ width: `${stats.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Action Hint */}
                      <div className="pt-2 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
                        <span>View All Checklists</span>
                        <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW 2: All Checklists under Selected Group as Full Screen Grid Buttons */
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-4 sm:p-6 md:p-8">
          {/* Active Group Header Summary Card */}
          {activeGroup && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 sm:p-5 mb-4 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500 text-blue-300 flex items-center justify-center shrink-0">
                  {activeGroup.isFlightGroup ? (
                    <Plane className="w-6 h-6" />
                  ) : activeGroup.code === 'DAY-OPS' ? (
                    <Sun className="w-6 h-6 text-amber-400" />
                  ) : (
                    <Building2 className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      {activeGroup.code}
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-white truncate">
                      {activeGroup.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any checklist button to start execution in interactive carousel mode.
                  </p>
                </div>
              </div>

              {/* Search Bar for Checklists */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-navigator-checklist-search"
                  type="text"
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  placeholder="Search checklists in this group..."
                  className="w-full bg-slate-900 text-white placeholder-slate-400 text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {checklistSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setChecklistSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Checklists Large Grid Covering Full Screen */}
          <div className="flex-1 overflow-y-auto py-2 pr-1 scrollbar-thin">
            {activeGroupChecklists.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-3">
                <FileText className="w-12 h-12 text-slate-500" />
                <h3 className="text-base font-bold text-white">No Checklists Found</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  No checklists match your search query in this operational group.
                </p>
                {checklistSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setChecklistSearchQuery('')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {activeGroupChecklists.map(({ subGroup, checklist }) => {
                  const isCompleted = checklist.status === 'completed';
                  const totalTasks = checklist.items?.length || 0;
                  const doneTasks = checklist.items?.filter((i) => i.status === 'done').length || 0;
                  const skippedTasks = checklist.items?.filter((i) => i.status === 'skipped').length || 0;
                  const pinnedTasks = checklist.items?.filter((i) => i.status === 'pinned').length || 0;
                  const missedTasks = checklist.items?.filter((i) => i.status === 'missed').length || 0;
                  const incorrectTasks = checklist.items?.filter((i) => i.status === 'incorrectly_executed').length || 0;
                  const nonCompliant = missedTasks + incorrectTasks;
                  const pct = totalTasks > 0 ? Math.round(((doneTasks + skippedTasks + pinnedTasks) / totalTasks) * 100) : 0;

                  return (
                    <button
                      key={checklist.id}
                      id={`btn-navigator-exec-checklist-${checklist.id}`}
                      type="button"
                      onClick={() => {
                        if (activeGroup) {
                          onSelectChecklist(activeGroup, subGroup, checklist);
                        }
                      }}
                      className={`group relative text-left bg-gradient-to-b from-slate-800 to-slate-900 border-2 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl cursor-pointer flex flex-col justify-between space-y-4 select-none ${
                        isCompleted
                          ? 'border-emerald-500/80 hover:border-emerald-400 ring-1 ring-emerald-500/30'
                          : nonCompliant > 0
                          ? 'border-rose-500/80 hover:border-rose-400 ring-1 ring-rose-500/30'
                          : pct > 0
                          ? 'border-amber-500/80 hover:border-amber-400 ring-1 ring-amber-500/30'
                          : 'border-slate-700 hover:border-blue-500 hover:ring-2 hover:ring-blue-500/30'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-bold">
                            {subGroup.name}
                          </span>
                          {checklist.version && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold">
                              {checklist.version}
                            </span>
                          )}
                        </div>

                        {/* Status Tag */}
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-black uppercase">
                            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                            Done ({doneTasks}/{totalTasks})
                          </span>
                        ) : nonCompliant > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600 text-[10px] font-black uppercase">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Issues ({nonCompliant})
                          </span>
                        ) : pct > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-black uppercase">
                            <Clock className="w-3 h-3 text-amber-400" />
                            In Progress ({doneTasks}/{totalTasks})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">
                            Not Started
                          </span>
                        )}
                      </div>

                      {/* Checklist Title */}
                      <div className="space-y-1.5">
                        <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition line-clamp-2 leading-snug">
                          {checklist.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{totalTasks} Safety Checks</span>
                          {checklist.isMandatory && (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                              <ShieldAlert className="w-3 h-3" />
                              Mandatory
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini Task Status Telemetry */}
                      <div className="pt-2 border-t border-slate-700/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Completion</span>
                          <span className={`font-black ${isCompleted ? 'text-emerald-400' : 'text-blue-400'}`}>
                            {pct}% ({doneTasks}/{totalTasks})
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Big Click-To-Execute Button Footer */}
                      <div className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md ${
                        isCompleted
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : pct > 0
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isCompleted ? 'REVIEW / MODIFY CHECKLIST' : pct > 0 ? 'CONTINUE EXECUTION' : 'START EXECUTION'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation Hint Bar */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 sm:px-8 py-2.5 text-xs text-slate-400 font-mono flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Navigation Mode:</span>
          {selectedGroupId ? (
            <span>Viewing Checklists in <strong className="text-blue-400">{activeGroup?.name}</strong></span>
          ) : (
            <span>Select any Operational Group to view its checklists</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">Esc</kbd> to {selectedGroupId ? 'return to groups' : 'exit'}</span>
        </div>
      </div>
    </div>
  );
}
