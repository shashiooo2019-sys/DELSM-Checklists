'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  DayOperationalData, 
  OperationalGroup, 
  SubOperationalGroup, 
  Checklist, 
  ChecklistItem,
  UserAccount 
} from '@/types/aviation';
import { isChecklistComplete } from '@/lib/storage';
import { 
  Search, 
  X, 
  Plane, 
  Building2, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Play, 
  Check, 
  SlidersHorizontal,
  Sun,
  AlertCircle,
  Sparkles,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Pin,
  AlertTriangle,
  MessageSquare,
  ListChecks,
  Eye
} from 'lucide-react';

interface ChecklistSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  onSelectChecklist: (group: OperationalGroup, subGroup: SubOperationalGroup, checklist: Checklist) => void;
}

interface SearchableChecklistItem {
  checklist: Checklist;
  subGroup: SubOperationalGroup;
  group: OperationalGroup;
  isFlightRelated: boolean;
  matchedItemText?: string;
}

export function ChecklistSearchModal({
  isOpen,
  onClose,
  dayData,
  currentUser,
  onSelectChecklist,
}: ChecklistSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'flight' | 'terminal' | 'dayshift'>('all');
  const [expandedChecklistIds, setExpandedChecklistIds] = useState<Record<string, boolean>>({});
  
  // Step state: 'search' | 'flight_picker'
  const [modalStep, setModalStep] = useState<'search' | 'flight_picker'>('search');
  const [pendingChecklistData, setPendingChecklistData] = useState<{
    checklistTitle: string;
    checklistSuffix?: string;
    targetChecklist: Checklist;
    sourceGroup: OperationalGroup;
    sourceSubGroup: SubOperationalGroup;
  } | null>(null);
  const [selectedFlightGroupId, setSelectedFlightGroupId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const toggleChecklistExpand = (checklistKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedChecklistIds((prev) => ({
      ...prev,
      [checklistKey]: prev[checklistKey] === undefined ? true : !prev[checklistKey],
    }));
  };

  const resetState = () => {
    setModalStep('search');
    setPendingChecklistData(null);
    setSelectedFlightGroupId(null);
    setSearchTerm('');
    setExpandedChecklistIds({});
  };

  const handleCloseModal = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // List of all active flight groups in the day's operations
  const flightGroups = useMemo(() => {
    return (dayData?.groups || []).filter((g) => g.isFlightGroup);
  }, [dayData]);

  // Flattened catalogue of unique / available checklists across all operational groups
  const allChecklistEntries = useMemo<SearchableChecklistItem[]>(() => {
    const entries: SearchableChecklistItem[] = [];
    const seenChecklistKeys = new Set<string>();

    for (const group of dayData?.groups || []) {
      const isFlight = group.isFlightGroup;
      for (const sub of group.subGroups || []) {
        for (const chk of sub.checklists || []) {
          // Unique key to avoid duplicate entries for turnaround templates
          const key = isFlight ? `flight-${chk.title.toLowerCase()}` : `group-${group.id}-${chk.id}`;
          
          if (!seenChecklistKeys.has(key)) {
            seenChecklistKeys.add(key);
            entries.push({
              checklist: chk,
              subGroup: sub,
              group: group,
              isFlightRelated: isFlight,
            });
          }
        }
      }
    }
    return entries;
  }, [dayData]);

  // Filtered search results
  const filteredResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return allChecklistEntries.filter((entry) => {
      // Category filter
      const isDayShift = entry.group.code === 'DAY-OPS' || entry.group.name.toLowerCase().includes('day shift');
      if (selectedCategory === 'flight' && !entry.isFlightRelated) return false;
      if (selectedCategory === 'terminal' && (entry.isFlightRelated || isDayShift)) return false;
      if (selectedCategory === 'dayshift' && !isDayShift) return false;

      if (!query) return true;

      // Match title
      if (entry.checklist.title.toLowerCase().includes(query)) return true;
      // Match group or subgroup
      if (entry.group.name.toLowerCase().includes(query) || entry.group.code.toLowerCase().includes(query)) return true;
      if (entry.subGroup.name.toLowerCase().includes(query)) return true;
      // Match items text
      const matchedItem = entry.checklist.items.find((item) => item.text.toLowerCase().includes(query));
      if (matchedItem) {
        entry.matchedItemText = matchedItem.text;
        return true;
      }

      return false;
    });
  }, [allChecklistEntries, searchTerm, selectedCategory]);

  const handleChecklistClick = (entry: SearchableChecklistItem) => {
    if (entry.isFlightRelated) {
      // Prompt for flight selection
      setPendingChecklistData({
        checklistTitle: entry.checklist.title,
        checklistSuffix: entry.checklist.id.split('-').pop(),
        targetChecklist: entry.checklist,
        sourceGroup: entry.group,
        sourceSubGroup: entry.subGroup,
      });
      // Default to first flight group if available
      if (flightGroups.length > 0) {
        setSelectedFlightGroupId(flightGroups[0].id);
      }
      setModalStep('flight_picker');
    } else {
      // Direct launch for non-flight checklists
      onSelectChecklist(entry.group, entry.subGroup, entry.checklist);
      handleCloseModal();
    }
  };

  const handleConfirmFlightSelection = (flightGroup: OperationalGroup) => {
    if (!pendingChecklistData) return;

    // Find the matching checklist inside this flight group
    let targetSub: SubOperationalGroup | null = null;
    let targetChk: Checklist | null = null;

    for (const sub of flightGroup.subGroups || []) {
      for (const chk of sub.checklists || []) {
        if (
          chk.title.trim().toLowerCase() === pendingChecklistData.checklistTitle.trim().toLowerCase() ||
          chk.id === pendingChecklistData.targetChecklist.id
        ) {
          targetSub = sub;
          targetChk = chk;
          break;
        }
      }
      if (targetChk) break;
    }

    // Fallback: if not found by exact title, pick first checklist in first subGroup
    if (!targetChk && flightGroup.subGroups.length > 0) {
      targetSub = flightGroup.subGroups[0];
      targetChk = targetSub.checklists[0] || pendingChecklistData.targetChecklist;
    }

    if (targetSub && targetChk) {
      onSelectChecklist(flightGroup, targetSub, targetChk);
      handleCloseModal();
    }
  };

  const getFlightRoute = (code: string) => {
    const clean = code.toUpperCase();
    if (clean.includes('147') || clean.includes('2647')) return 'DEL ➔ ZRH (Zurich)';
    if (clean.includes('763')) return 'DEL ➔ MUC (Munich)';
    if (clean.includes('761')) return 'DEL ➔ FRA (Frankfurt)';
    return 'DEL Station Flight';
  };

  // Helper to render an item row inside cards
  const renderItemDetailRow = (item: ChecklistItem, idx: number, highlightQuery?: string) => {
    const isDone = item.status === 'done';
    const isPinned = item.status === 'pinned';
    const isSkipped = item.status === 'skipped';
    const isMissed = item.status === 'missed';
    const isIncorrect = item.status === 'incorrectly_executed';
    const isPending = item.status === 'not_done';

    return (
      <div 
        key={`detail-${item.id || idx}`}
        className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 ${
          isDone
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : isMissed || isIncorrect
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : isPinned
            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
            : isSkipped
            ? 'bg-slate-100/80 border-slate-200 text-slate-700'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xs hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0 ${
              isDone 
                ? 'bg-emerald-600 text-white' 
                : isMissed || isIncorrect 
                ? 'bg-rose-600 text-white' 
                : isPinned 
                ? 'bg-amber-500 text-slate-950' 
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              #{item.sequenceOrder}
            </span>

            {item.isMandatory ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase border border-rose-200 shrink-0">
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                Mandatory
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase border border-slate-200 shrink-0">
                Optional
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                <Check className="w-3 h-3 text-emerald-700 stroke-[3]" /> DONE
              </span>
            )}
            {isPinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300">
                <Pin className="w-3 h-3 text-amber-700" /> PINNED
              </span>
            )}
            {isSkipped && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                SKIPPED
              </span>
            )}
            {isMissed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[10px] font-black border border-rose-300">
                MISSED ❌
              </span>
            )}
            {isIncorrect && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200 text-rose-950 text-[10px] font-black border border-rose-300">
                <AlertTriangle className="w-3 h-3 text-rose-700" /> INCORRECT ❌
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold border border-slate-200">
                PENDING
              </span>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm font-semibold leading-relaxed break-words mt-0.5">
          {item.text}
        </p>

        {(item.actionBy || item.skipReason || item.remark || item.actionAt) && (
          <div className="pt-1.5 mt-0.5 border-t border-slate-200/70 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
            {item.actionBy && (
              <span>Actioned by: <strong className="text-slate-800 font-bold">{item.actionBy}</strong></span>
            )}
            {item.skipReason && (
              <span className="text-amber-900 italic font-medium">Skip Note: {item.skipReason}</span>
            )}
            {item.remark && (
              <span className="text-rose-900 font-bold flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-rose-600" /> Remark: {item.remark}
              </span>
            )}
            {item.actionAt && (
              <span className="font-mono text-[10px] text-slate-500">
                {new Date(item.actionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        id="checklist-search-modal"
        className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[92vh] sm:max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  {modalStep === 'search' ? 'Checklist Search & Direct Execution' : 'Select Turnaround Flight'}
                </h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {modalStep === 'search' ? `${filteredResults.length} Checklists` : 'Flight Selector'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {modalStep === 'search' 
                  ? 'Browse all checklists with full item details, review safety points, and launch execution' 
                  : `Assign "${pendingChecklistData?.checklistTitle}" to an active turnaround flight`}
              </p>
            </div>
          </div>

          <button
            id="btn-close-search-modal"
            type="button"
            onClick={handleCloseModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {modalStep === 'search' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  id="input-checklist-search-query"
                  type="text"
                  placeholder="Type checklist name, task text, or keyword (e.g. Gate, Ramp, Crew, Fuel, DT, Bags, SBD)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition shadow-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Filter Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All Checklists ({allChecklistEntries.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('flight')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === 'flight'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>Flight Turnarounds</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('terminal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === 'terminal'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Terminal Ops</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCategory('dayshift')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === 'dayshift'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span>Day Shift Handover</span>
                </button>
              </div>
            </div>

            {/* Checklist Results List with Prominent Item Details */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-50/60">
              {filteredResults.length === 0 ? (
                <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                  <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-base font-bold text-slate-800">No checklists match &ldquo;{searchTerm}&rdquo;</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try searching by task keywords like &ldquo;Gate&rdquo;, &ldquo;Ramp&rdquo;, &ldquo;Arrival&rdquo;, &ldquo;Departure&rdquo;, &ldquo;Fueling&rdquo;, &ldquo;Weapons&rdquo;, or &ldquo;Crew&rdquo;.
                  </p>
                </div>
              ) : (
                filteredResults.map((entry, idx) => {
                  const checklistKey = `chk-${entry.group.id}-${entry.checklist.id}-${idx}`;
                  const isDayShift = entry.group.code === 'DAY-OPS' || entry.group.name.toLowerCase().includes('day shift');
                  const isCompleted = isChecklistComplete(entry.checklist);
                  const isPending = entry.checklist.status === 'pending';
                  const totalItems = entry.checklist.items.length;
                  const doneItems = entry.checklist.items.filter(i => i.status === 'done').length;
                  const mandatoryItems = entry.checklist.items.filter(i => i.isMandatory).length;
                  
                  // By default in search mode, keep cards expanded or open so items are prominently visible
                  const isExpanded = expandedChecklistIds[checklistKey] !== undefined ? expandedChecklistIds[checklistKey] : true;

                  return (
                    <div
                      key={checklistKey}
                      id={`search-card-${entry.checklist.id}`}
                      className="bg-white border-2 border-slate-200 hover:border-blue-400/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
                    >
                      {/* Card Top Header */}
                      <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Badges row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.isFlightRelated ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-extrabold tracking-wide uppercase border border-blue-200">
                                <Plane className="w-3 h-3 text-blue-700" />
                                Flight Turnaround Template
                              </span>
                            ) : isDayShift ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 text-[10px] font-extrabold tracking-wide uppercase border border-amber-300">
                                <Sun className="w-3 h-3 text-amber-700" />
                                Day Shift Operations
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-extrabold tracking-wide uppercase border border-slate-200">
                                <Building2 className="w-3 h-3 text-slate-700" />
                                Terminal / Station
                              </span>
                            )}

                            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {entry.group.name}
                            </span>

                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              {entry.checklist.version || 'v1.0'}
                            </span>
                          </div>

                          {/* Title */}
                          <div className="flex items-center gap-2">
                            <h4 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                              <span>{entry.checklist.title}</span>
                              {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              )}
                            </h4>
                          </div>

                          {/* Quick Summary & Matched Task Notification */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                            <span className="font-semibold text-slate-700">
                              {totalItems} items ({mandatoryItems} Mandatory)
                            </span>
                            <span>·</span>
                            <span>
                              Status: <strong className={isCompleted ? 'text-emerald-700 font-bold' : isPending ? 'text-amber-700 font-bold' : 'text-blue-700 font-bold'}>{entry.checklist.status.toUpperCase()}</strong>
                            </span>
                            <span>·</span>
                            <span className="text-slate-600 font-mono text-[11px]">
                              Done: <strong className="text-emerald-700">{doneItems}/{totalItems}</strong>
                            </span>
                          </div>

                          {entry.matchedItemText && (
                            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-blue-900">Search Matched Task:</span> &ldquo;{entry.matchedItemText}&rdquo;
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => toggleChecklistExpand(checklistKey, e)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            title={isExpanded ? 'Hide item list' : 'View all items'}
                          >
                            <ListChecks className="w-4 h-4 text-slate-600" />
                            <span>{isExpanded ? 'Collapse Items' : `View All Items (${totalItems})`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {entry.isFlightRelated ? (
                            <button
                              type="button"
                              onClick={() => handleChecklistClick(entry)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                              <Plane className="w-3.5 h-3.5" />
                              <span>Execute on Flight</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleChecklistClick(entry)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Start Execution Carousel</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Prominently Displayed Checklist Items Cards */}
                      {isExpanded && (
                        <div className="p-3 sm:p-5 bg-slate-50/80 border-t border-slate-200/80 space-y-2.5">
                          <div className="flex items-center justify-between pb-1 text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-500 font-mono">
                              <ListChecks className="w-4 h-4 text-blue-600" />
                              Checklist Execution Tasks ({totalItems} items)
                            </span>
                            <span className="text-[11px] font-normal text-slate-500">
                              Click &ldquo;Execute on Flight / Start&rdquo; to execute step-by-step
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                            {entry.checklist.items.map((item, itemIdx) => 
                              renderItemDetailRow(item, itemIdx, searchTerm)
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Flight Selection Step */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Target Checklist Header Bar */}
            <div className="p-4 bg-blue-50/90 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <button
                  type="button"
                  onClick={() => setModalStep('search')}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 mb-1 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Checklist Search</span>
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-600">Selected Checklist:</span>
                  <span className="text-sm font-extrabold text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    {pendingChecklistData?.checklistTitle}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({pendingChecklistData?.targetChecklist.items.length || 0} items)
                  </span>
                </div>
              </div>

              <span className="text-xs text-blue-900 font-bold bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200 self-start sm:self-center">
                Select turnaround flight below to start execution
              </span>
            </div>

            {/* Target Checklist Preview + Flight Selector Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60">
              {/* Target Checklist Item Details Inspection Box */}
              {pendingChecklistData?.targetChecklist && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-blue-600" />
                      Tasks Included in This Turnaround Checklist
                    </h5>
                    <span className="text-[11px] font-mono text-slate-500">
                      {pendingChecklistData.targetChecklist.items.length} tasks ({pendingChecklistData.targetChecklist.items.filter(i => i.isMandatory).length} Mandatory)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                    {pendingChecklistData.targetChecklist.items.map((item, idx) => (
                      <div 
                        key={`preview-item-${item.id || idx}`}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-start gap-2"
                      >
                        <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          #{item.sequenceOrder}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            {item.isMandatory ? (
                              <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 uppercase">
                                Mandatory
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-600 bg-slate-200/70 px-1.5 py-0.2 rounded uppercase">
                                Optional
                              </span>
                            )}
                          </div>
                          <p className="text-slate-800 font-medium line-clamp-2 leading-snug">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flight Cards Grid */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Target Turnaround Flight
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {flightGroups.map((flight) => {
                    const isSelected = selectedFlightGroupId === flight.id;
                    const routeText = getFlightRoute(flight.code || flight.name);
                    
                    // Check status of target checklist in this flight
                    let targetStatus = 'Not Started';
                    let completedCount = 0;
                    let totalCount = 0;
                    for (const sub of flight.subGroups || []) {
                      for (const chk of sub.checklists || []) {
                        if (
                          chk.title.trim().toLowerCase() === pendingChecklistData?.checklistTitle.trim().toLowerCase() ||
                          chk.id === pendingChecklistData?.targetChecklist.id
                        ) {
                          targetStatus = chk.status === 'completed' ? 'Completed' : chk.status === 'in_progress' ? 'In Progress' : 'Pending';
                          completedCount = chk.items.filter(i => i.status === 'done' || i.status === 'skipped').length;
                          totalCount = chk.items.length;
                        }
                      }
                    }

                    return (
                      <div
                        key={flight.id}
                        id={`flight-option-${flight.id}`}
                        onClick={() => setSelectedFlightGroupId(flight.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              <Plane className="w-5 h-5 transform -rotate-45" />
                            </div>
                            <div>
                              <div className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                                <span>{flight.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {flight.code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">{routeText}</p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Checklist Progress:</span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                            targetStatus === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : targetStatus === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {targetStatus} {totalCount > 0 && `(${completedCount}/${totalCount})`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmFlightSelection(flight);
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start on {flight.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Flight Picker Action Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalStep('search')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Back to Search
              </button>

              <button
                type="button"
                disabled={!selectedFlightGroupId}
                onClick={() => {
                  const targetFlight = flightGroups.find(g => g.id === selectedFlightGroupId);
                  if (targetFlight) handleConfirmFlightSelection(targetFlight);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
              >
                <span>Launch on Selected Flight</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
