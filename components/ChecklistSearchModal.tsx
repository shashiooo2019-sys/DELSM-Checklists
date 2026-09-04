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
  Eye,
  Layers,
  MousePointerClick
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
  matchedItems?: string[];
  fuzzyScore?: number;
}

const SYNONYM_MAP: Record<string, string[]> = {
  pax: ['passenger', 'passengers', 'board', 'deboard', 'boarding', 'deboarding', 'crew'],
  bag: ['baggage', 'bags', 'luggage', 'cargo', 'uld', 'hold'],
  bags: ['baggage', 'luggage', 'cargo', 'uld'],
  ramp: ['ground', 'safety', 'marshalling', 'chocks', 'apron', 'cone', 'fod'],
  fuel: ['fueling', 'refueling', 'bowser', 'tanker', 'fuel'],
  gate: ['bridge', 'aerobridge', 'boarding', 'terminal', 'gate'],
  clean: ['cabin', 'cleaning', 'catering', 'lavatory', 'trash'],
  dt: ['delay', 'pushback', 'departure', 'on-time'],
  delay: ['pushback', 'departure', 'on-time', 'slot'],
  sec: ['security', 'screening', 'seal', 'clearance'],
};

// Fuzzy match calculator for checklist search
function calculateFuzzyMatch(
  query: string,
  entry: SearchableChecklistItem
): { isMatched: boolean; matchedItems: string[]; score: number } {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return { isMatched: true, matchedItems: [], score: 100 };

  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
  const matchedItemTexts: string[] = [];
  let score = 0;

  // 1. Title Match
  const titleLower = entry.checklist.title.toLowerCase();
  if (titleLower.includes(cleanQuery)) {
    score += 100;
  } else {
    const titleMatchedTokens = queryTokens.filter((token) => titleLower.includes(token));
    if (titleMatchedTokens.length > 0) {
      score += titleMatchedTokens.length * 35;
    }
  }

  // 2. Group / Subgroup Match
  const groupLower = entry.group.name.toLowerCase();
  const subLower = entry.subGroup.name.toLowerCase();
  if (groupLower.includes(cleanQuery) || subLower.includes(cleanQuery)) {
    score += 40;
  }

  // 3. Item-level fuzzy & synonym match
  for (const item of entry.checklist.items) {
    const itemTextLower = item.text.toLowerCase();
    const itemRemarkLower = (item.remark || '').toLowerCase();

    // Direct substring check
    if (itemTextLower.includes(cleanQuery) || itemRemarkLower.includes(cleanQuery)) {
      if (!matchedItemTexts.includes(item.text)) {
        matchedItemTexts.push(item.text);
      }
      score += 50;
      continue;
    }

    // Token-level check with synonyms
    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (itemTextLower.includes(token) || itemRemarkLower.includes(token)) {
        tokenMatches++;
        continue;
      }

      const synonyms = SYNONYM_MAP[token] || [];
      if (synonyms.some((syn) => itemTextLower.includes(syn) || itemRemarkLower.includes(syn))) {
        tokenMatches++;
        continue;
      }

      // Prefix / fuzzy word match
      const words = itemTextLower.split(/\s+/);
      const isFuzzy = words.some((w) => {
        if (token.length >= 3 && w.startsWith(token.substring(0, 3))) return true;
        return false;
      });
      if (isFuzzy) {
        tokenMatches++;
      }
    }

    if (tokenMatches > 0) {
      if (!matchedItemTexts.includes(item.text)) {
        matchedItemTexts.push(item.text);
      }
      score += tokenMatches * 25;
    }
  }

  return {
    isMatched: score > 0,
    matchedItems: matchedItemTexts,
    score,
  };
}

// 3D Tile Button Component
function Checklist3DTile({
  entry,
  searchTerm,
  onClick,
}: {
  entry: SearchableChecklistItem;
  searchTerm: string;
  onClick: () => void;
}) {
  const isCompleted = isChecklistComplete(entry.checklist);
  const totalItems = entry.checklist.items.length;
  const mandatoryItems = entry.checklist.items.filter((i) => i.isMandatory).length;
  const isDayShift = entry.group.code === 'DAY-OPS' || entry.group.name.toLowerCase().includes('day shift');

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl p-4 sm:p-5 cursor-pointer select-none transition-all duration-200 flex flex-col justify-between ${
        entry.isFlightRelated
          ? 'bg-gradient-to-br from-white via-blue-50/40 to-blue-100/30 border-2 border-blue-200 hover:border-blue-500 shadow-[0_4px_0_0_rgba(191,219,254,0.9),0_6px_14px_-3px_rgba(37,99,235,0.12)] hover:shadow-[0_8px_16px_-4px_rgba(37,99,235,0.2),0_4px_0_0_rgba(59,130,246,0.6)]'
          : isDayShift
          ? 'bg-gradient-to-br from-white via-amber-50/30 to-amber-100/30 border-2 border-amber-300 hover:border-amber-500 shadow-[0_4px_0_0_rgba(253,230,138,0.95),0_6px_14px_-3px_rgba(217,119,6,0.12)] hover:shadow-[0_8px_16px_-4px_rgba(245,158,11,0.2),0_4px_0_0_rgba(217,119,6,0.6)]'
          : 'bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 border-2 border-slate-300 hover:border-indigo-500 shadow-[0_4px_0_0_rgba(203,213,225,0.95),0_6px_14px_-3px_rgba(15,23,42,0.12)] hover:shadow-[0_8px_16px_-4px_rgba(79,70,229,0.18),0_4px_0_0_rgba(99,102,241,0.6)]'
      }`}
    >
      {/* 3D Sheen Highlight Overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-white/20 to-white/40 pointer-events-none" />

      {/* Card Header & Badges */}
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {entry.isFlightRelated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black tracking-wider uppercase shadow-xs">
              <Plane className="w-3 h-3 text-sky-200 transform -rotate-45" />
              Flight Turnaround
            </span>
          ) : isDayShift ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black tracking-wider uppercase shadow-xs">
              <Sun className="w-3 h-3 text-amber-950" />
              Day Shift Handover
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase shadow-xs">
              <Building2 className="w-3 h-3 text-indigo-200" />
              Terminal Operations
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/80 text-slate-700 border border-slate-200 shadow-2xs">
              {entry.checklist.version || 'v1.0'}
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                <Check className="w-3 h-3 text-emerald-700 stroke-[3]" /> DONE
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors flex items-center gap-2">
            <span>{entry.checklist.title}</span>
            {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          </h4>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Group: <strong className="text-slate-700">{entry.group.name}</strong> · Sub: <strong className="text-slate-700">{entry.subGroup.name}</strong>
          </p>
        </div>

        {/* Task Stats Bar */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white/70 backdrop-blur-xs p-2 rounded-xl border border-slate-200/80">
          <ListChecks className="w-4 h-4 text-blue-600" />
          <span>{totalItems} Tasks</span>
          <span className="text-slate-300">|</span>
          <span className="text-rose-700 font-bold">{mandatoryItems} Mandatory</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{totalItems - mandatoryItems} Optional</span>
        </div>

        {/* Matched Items Pill if Search Match */}
        {entry.matchedItems && entry.matchedItems.length > 0 && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Fuzzy Matched {entry.matchedItems.length} Task(s):</span>
            </div>
            <p className="text-[11px] text-blue-900 italic line-clamp-2">
              &ldquo;{entry.matchedItems[0]}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* 3D Action Execute Button (Triggers Prompt or Direct Launch) */}
      <div className="relative z-10 pt-4 mt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
          <MousePointerClick className="w-3.5 h-3.5 text-blue-600 animate-bounce" />
          {entry.isFlightRelated ? 'Click to select flight' : 'Click to launch carousel'}
        </span>

        {entry.isFlightRelated ? (
          <button
            type="button"
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition active:scale-95"
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Select Flight & Execute</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 group-hover:from-emerald-500 group-hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute Now</span>
          </button>
        )}
      </div>
    </div>
  );
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

  // Step state: 'search' | 'flight_picker'
  const [modalStep, setModalStep] = useState<'search' | 'flight_picker'>('search');
  const [pendingChecklistData, setPendingChecklistData] = useState<{
    checklistTitle: string;
    targetChecklist: Checklist;
    sourceGroup: OperationalGroup;
    sourceSubGroup: SubOperationalGroup;
  } | null>(null);
  const [selectedFlightGroupId, setSelectedFlightGroupId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setModalStep('search');
    setPendingChecklistData(null);
    setSelectedFlightGroupId(null);
    setSearchTerm('');
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

  // Catalogue of unique checklists across all operational groups (DEDUPLICATING FLIGHT CHECKLISTS ONLY ONCE)
  const allChecklistEntries = useMemo<SearchableChecklistItem[]>(() => {
    const entries: SearchableChecklistItem[] = [];
    const seenChecklistKeys = new Set<string>();

    for (const group of dayData?.groups || []) {
      const isFlight = group.isFlightGroup;
      for (const sub of group.subGroups || []) {
        for (const chk of sub.checklists || []) {
          const normTitle = chk.title.trim().toLowerCase();
          // DEDUPLICATION: For flight groups, show each flight turnaround checklist template ONLY ONCE
          const key = isFlight ? `flight-template-${normTitle}` : `group-${group.id}-${sub.id}-${chk.id}`;

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

  // Filtered and Fuzzy-Searched Checklist Results
  const filteredResults = useMemo(() => {
    const results = allChecklistEntries
      .map((entry) => {
        // Category filter
        const isDayShift = entry.group.code === 'DAY-OPS' || entry.group.name.toLowerCase().includes('day shift');
        if (selectedCategory === 'flight' && !entry.isFlightRelated) return null;
        if (selectedCategory === 'terminal' && (entry.isFlightRelated || isDayShift)) return null;
        if (selectedCategory === 'dayshift' && !isDayShift) return null;

        const { isMatched, matchedItems, score } = calculateFuzzyMatch(searchTerm, entry);
        if (!isMatched) return null;

        const itemResult: SearchableChecklistItem = {
          ...entry,
          matchedItems,
          fuzzyScore: score,
        };
        return itemResult;
      })
      .filter((item): item is SearchableChecklistItem => item !== null);

    return results.sort((a, b) => (b.fuzzyScore || 0) - (a.fuzzyScore || 0));
  }, [allChecklistEntries, searchTerm, selectedCategory]);

  const handleChecklistClick = (entry: SearchableChecklistItem) => {
    if (entry.isFlightRelated) {
      // Prompt user to pick a target flight
      setPendingChecklistData({
        checklistTitle: entry.checklist.title,
        targetChecklist: entry.checklist,
        sourceGroup: entry.group,
        sourceSubGroup: entry.subGroup,
      });
      setSelectedFlightGroupId(null);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div 
        id="checklist-search-modal"
        className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[92vh] sm:max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {modalStep === 'search' ? 'Find & Execute Checklists' : 'Select Flight for Checklist Execution'}
                </h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold">
                  {modalStep === 'search' ? `${filteredResults.length} Unique Checklists` : 'Flight Picker Prompt'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {modalStep === 'search' 
                  ? 'All flight turnaround templates listed ONCE. Search title & fuzzy task items with 3D tile buttons.' 
                  : `Select which active turnaround flight to execute "${pendingChecklistData?.checklistTitle}" on.`}
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
            {/* Search Input Bar & Category Filters */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  id="input-checklist-search-query"
                  type="text"
                  placeholder="Type title or fuzzy item keyword (e.g., pax, fuel, ramp, bag, gate, deboard, cargo, cabin, security)..."
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

              {/* Category Filter Chips */}
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
                  All Unique Checklists ({allChecklistEntries.length})
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
                  <span>Flight Turnarounds (Deduplicated)</span>
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

            {/* Checklist Results: 3D Tile Buttons Grid with Tilt & Hover Details */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
              {filteredResults.length === 0 ? (
                <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                  <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-base font-bold text-slate-800">No checklists match &ldquo;{searchTerm}&rdquo;</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Try fuzzy keywords like &ldquo;pax&rdquo;, &ldquo;ramp&rdquo;, &ldquo;bag&rdquo;, &ldquo;fuel&rdquo;, &ldquo;gate&rdquo;, &ldquo;cargo&rdquo;, &ldquo;deboard&rdquo;, or &ldquo;clean&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {filteredResults.map((entry, idx) => (
                    <Checklist3DTile
                      key={`chk-3d-tile-${entry.checklist.id}-${idx}`}
                      entry={entry}
                      searchTerm={searchTerm}
                      onClick={() => handleChecklistClick(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Flight Selection Prompt Step */
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
                  <span className="text-xs font-bold text-slate-600">Selected Checklist Template:</span>
                  <span className="text-sm font-extrabold text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    {pendingChecklistData?.checklistTitle}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({pendingChecklistData?.targetChecklist.items.length || 0} tasks)
                  </span>
                </div>
              </div>

              <span className="text-xs text-blue-900 font-bold bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 self-start sm:self-center">
                Select turnaround flight below to launch execution
              </span>
            </div>

            {/* Flight Selector Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                    <Plane className="w-4 h-4 text-blue-600" />
                    Select Active Turnaround Flight for Execution
                  </h5>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedFlightGroupId ? 'Flight selected' : 'Click a flight card to pick'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {flightGroups.map((flight) => {
                    const isSelected = selectedFlightGroupId === flight.id;
                    const routeText = getFlightRoute(flight.code || flight.name);

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
                          completedCount = chk.items.filter((i) => i.status === 'done' || i.status === 'skipped').length;
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
                            ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-md translate-y-[-2px]'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
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

                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Flight Progress:</span>
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
                          <span>Execute Checklist on {flight.name}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Checklist Task Preview Panel */}
              {pendingChecklistData?.targetChecklist && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5 mt-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                      <ListChecks className="w-4 h-4 text-blue-600" />
                      Turnaround Tasks Preview ({pendingChecklistData.targetChecklist.items.length} tasks)
                    </h5>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {pendingChecklistData.targetChecklist.items.map((item, idx) => (
                      <div 
                        key={`preview-item-${item.id || idx}`}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-start gap-2"
                      >
                        <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          #{item.sequenceOrder}
                        </span>
                        <div className="flex-1 min-w-0">
                          {item.isMandatory && (
                            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200 uppercase mr-1">
                              Mandatory
                            </span>
                          )}
                          <span className="text-slate-800 font-medium">
                            {item.text}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  const targetFlight = flightGroups.find((g) => g.id === selectedFlightGroupId);
                  if (targetFlight) handleConfirmFlightSelection(targetFlight);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
              >
                <span>Launch Execution on Selected Flight</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

