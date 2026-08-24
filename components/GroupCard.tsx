'use client';

import React, { useState } from 'react';
import { OperationalGroup, SubOperationalGroup, Checklist, UserAccount } from '@/types/aviation';
import { isGroupComplete, isSubGroupComplete, isChecklistComplete, getChecklistProgress } from '@/lib/storage';
import { 
  Plane, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  Play, 
  Check, 
  ShieldCheck, 
  Stethoscope, 
  AlertTriangle, 
  Lock, 
  Building2, 
  FileText,
  User,
  ShieldAlert,
  RotateCcw,
  Share2,
  Unlock
} from 'lucide-react';

interface GroupCardProps {
  group: OperationalGroup;
  currentUser: UserAccount | null;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onOpenChecklist: (group: OperationalGroup, subGroup: SubOperationalGroup, checklist: Checklist) => void;
  onOpenDiagnosis: (groupId: string) => void;
  onResetChecklist?: (group: OperationalGroup, subGroup: SubOperationalGroup, checklist: Checklist) => void;
  onOpenDayShiftDiagnosis?: (groupId: string) => void;
  onOpenDayShiftWhatsApp?: () => void;
  onReopenGroup?: (groupId: string) => void;
}

export function GroupCard({
  group,
  currentUser,
  isExpanded: propIsExpanded,
  onToggleExpand,
  onOpenChecklist,
  onOpenDiagnosis,
  onResetChecklist,
  onOpenDayShiftDiagnosis,
  onOpenDayShiftWhatsApp,
  onReopenGroup,
}: GroupCardProps) {
  const [localIsExpanded, setLocalIsExpanded] = useState<boolean>(false); // Default collapsed mode
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : localIsExpanded;
  const handleToggle = onToggleExpand || (() => setLocalIsExpanded((prev) => !prev));
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});
  const [showReopenConfirm, setShowReopenConfirm] = useState<boolean>(false);

  const groupComplete = isGroupComplete(group);
  const isSupervisor = currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN';
  const isDayShift = group.code === 'DAY-OPS' || group.name.includes('Day Shift');

  // Toggle sub-group accordion
  const toggleSubGroup = (subId: string) => {
    setExpandedSubGroups((prev) => ({
      ...prev,
      [subId]: prev[subId] === undefined ? false : !prev[subId],
    }));
  };

  // Group item count totals
  let totalItems = 0;
  let doneItems = 0;
  let totalChecklists = 0;
  let completedChecklists = 0;

  for (const sub of group.subGroups || []) {
    for (const chk of sub.checklists || []) {
      totalChecklists++;
      if (chk.status === 'completed') completedChecklists++;
      for (const item of chk.items || []) {
        totalItems++;
        if (item.status === 'done' || item.status === 'skipped') doneItems++;
      }
    }
  }

  const checklistProgressPercent = totalChecklists > 0 
    ? Math.round((completedChecklists / totalChecklists) * 100) 
    : (totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0);

  return (
    <div 
      id={`group-card-${group.id}`}
      className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
        group.isVerified
          ? 'border-sky-300 ring-1 ring-sky-200'
          : groupComplete
          ? 'border-emerald-300 ring-1 ring-emerald-200'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Group Header Card */}
      <div className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div 
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              group.isFlightGroup
                ? 'bg-blue-50 border border-blue-200 text-blue-600'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-600'
            }`}
          >
            {group.isFlightGroup ? <Plane className="w-6 h-6 transform -rotate-45" /> : <Building2 className="w-6 h-6" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {group.name}
              </h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                {group.code}
              </span>
              {group.isMandatory && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Mandatory Group
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              <span>{group.subGroups.length} Sub-Operations</span>
              <span>·</span>
              <span>
                Checklists: <strong className="text-slate-800">{completedChecklists}/{totalChecklists}</strong>
              </span>
              <span>·</span>
              <span>
                Progress: <strong className="text-emerald-600 font-bold">{checklistProgressPercent}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicators & Control Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Badge */}
          {group.isVerified ? (
            isDayShift ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>SHIFT VERIFIED AND CLOSED</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>SUPERVISOR VERIFIED</span>
              </div>
            )
          ) : groupComplete ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>ALL CHECKS COMPLETE</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>IN-PROGRESS ({checklistProgressPercent}%)</span>
            </div>
          )}

          {/* Supervisor Direct Diagnosis & Reopen Button */}
          {isSupervisor && (
            isDayShift ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  id={`btn-close-dayshift-${group.id}`}
                  type="button"
                  onClick={() => onOpenDayShiftDiagnosis ? onOpenDayShiftDiagnosis(group.id) : onOpenDiagnosis(group.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                    group.isVerified
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                  title={group.isVerified ? 'Day Shift Verified & Closed (Click to view diagnosis or reopen)' : 'Close Day Shift (Duty 2)'}
                >
                  <Stethoscope className={`w-3.5 h-3.5 ${group.isVerified ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span>{group.isVerified ? 'Shift Verified & Closed' : 'Close Day Shift'}</span>
                </button>

                {group.isVerified && onReopenGroup && (
                  <button
                    id={`btn-reopen-dayshift-header-${group.id}`}
                    type="button"
                    onClick={() => {
                      if (!showReopenConfirm) {
                        setShowReopenConfirm(true);
                        setTimeout(() => setShowReopenConfirm(false), 4000);
                      } else {
                        onReopenGroup(group.id);
                        setShowReopenConfirm(false);
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border ${
                      showReopenConfirm
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 animate-pulse font-extrabold'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                    title="Reopen Day Shift Operations for rework"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{showReopenConfirm ? 'Confirm Reopen?' : 'Reopen Day Shift'}</span>
                  </button>
                )}

                {onOpenDayShiftWhatsApp && (
                  <button
                    id={`btn-whatsapp-dayshift-${group.id}`}
                    type="button"
                    onClick={onOpenDayShiftWhatsApp}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    title="WhatsApp Day Shift Summary"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {group.isVerified && onReopenGroup && (
                  <button
                    id={`btn-reopen-group-header-${group.id}`}
                    type="button"
                    onClick={() => {
                      if (!showReopenConfirm) {
                        setShowReopenConfirm(true);
                        setTimeout(() => setShowReopenConfirm(false), 4000);
                      } else {
                        onReopenGroup(group.id);
                        setShowReopenConfirm(false);
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer border ${
                      showReopenConfirm
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 animate-pulse font-extrabold'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                    title="Reopen Group for rework"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{showReopenConfirm ? 'Confirm Reopen?' : 'Reopen'}</span>
                  </button>
                )}
                <button
                  id={`btn-diagnose-group-${group.id}`}
                  type="button"
                  onClick={() => onOpenDiagnosis(group.id)}
                  className="p-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-xl border border-amber-200 transition shadow-2xs cursor-pointer"
                  title="Supervisor Diagnosis & Sign-off"
                >
                  <Stethoscope className="w-4 h-4" />
                </button>
              </div>
            )
          )}

          {/* Toggle Accordion */}
          <button
            id={`btn-toggle-group-${group.id}`}
            type="button"
            onClick={handleToggle}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Smooth CSS Progress Bar */}
      <div className="w-full bg-slate-100 h-2 overflow-hidden border-t border-b border-slate-100">
        <div 
          id={`progress-bar-group-${group.id}`}
          className={`h-full transition-all duration-700 ease-in-out ${
            group.isVerified 
              ? isDayShift ? 'bg-emerald-500' : 'bg-sky-500' 
              : groupComplete || checklistProgressPercent === 100
              ? 'bg-blue-600' 
              : 'bg-amber-500'
          }`}
          style={{ width: `${checklistProgressPercent}%` }}
        />
      </div>

      {/* Verified Stamp Banner */}
      {group.isVerified && (
        <div className={`px-4 sm:px-6 py-2 border-b text-xs flex items-center justify-between flex-wrap gap-2 ${
          isDayShift ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-sky-50 border-sky-100 text-sky-800'
        }`}>
          <div className="flex items-center gap-2">
            <Lock className={`w-3.5 h-3.5 ${isDayShift ? 'text-emerald-600' : 'text-sky-600'}`} />
            <span>
              {isDayShift ? 'Shift Verified and Closed by: ' : 'Authorized by Supervisor: '}
              <strong>{group.verifiedBy || 'Duty Supervisor'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {group.verifiedAt && (
              <span className={`text-[11px] font-mono font-semibold ${isDayShift ? 'text-emerald-700' : 'text-sky-600'}`}>
                {new Date(group.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} · Locked & Verified
              </span>
            )}
            {isSupervisor && onReopenGroup && (
              <button
                id={`btn-banner-reopen-group-${group.id}`}
                type="button"
                onClick={() => {
                  if (!showReopenConfirm) {
                    setShowReopenConfirm(true);
                    setTimeout(() => setShowReopenConfirm(false), 4000);
                  } else {
                    onReopenGroup(group.id);
                    setShowReopenConfirm(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer border ${
                  showReopenConfirm
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 animate-pulse font-extrabold'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                }`}
                title={isDayShift ? 'Reopen Day Shift Operations for rework' : 'Reopen group for rework'}
              >
                <Unlock className="w-3 h-3" />
                <span>{showReopenConfirm ? 'Confirm Reopen?' : (isDayShift ? 'Reopen Day Shift' : 'Reopen Group')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-Groups Content */}
      {isExpanded && (
        <div className="p-3 sm:p-5 space-y-4 bg-slate-50/60">
          {group.subGroups.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No Sub-Groups Configured</p>
              <p className="text-xs text-slate-400 mt-0.5">Use the Admin Management panel to add custom sub-groups and checklists.</p>
            </div>
          ) : (
            group.subGroups.map((subGroup) => {
              const subComplete = isSubGroupComplete(subGroup);
              const isSubExpanded = expandedSubGroups[subGroup.id] !== false; // default true

              return (
                <div 
                  key={subGroup.id}
                  id={`subgroup-${subGroup.id}`}
                  className={`bg-white border rounded-xl overflow-hidden shadow-2xs transition ${
                    subComplete ? 'border-emerald-200' : 'border-slate-200'
                  }`}
                >
                {/* SubGroup Header */}
                <div 
                  onClick={() => toggleSubGroup(subGroup.id)}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between gap-3 border-b border-slate-200 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                        subComplete
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {subComplete ? <Check className="w-3.5 h-3.5" /> : '•'}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{subGroup.name}</span>
                        {subGroup.code && (
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded font-semibold">
                            {subGroup.code}
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {subGroup.checklists.filter((c) => c.status === 'completed').length}/{subGroup.checklists.length} checklists
                    </span>
                    <span className="text-slate-400">
                      {isSubExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </div>

                {/* Checklists List */}
                {isSubExpanded && (
                  <div className="p-3 space-y-2.5 bg-white">
                    {subGroup.checklists.map((chk) => {
                      const prog = getChecklistProgress(chk);
                      const isComplete = chk.status === 'completed';
                      const hasNonCompliance = prog.missed > 0 || prog.incorrectlyExecuted > 0;

                      return (
                        <div
                          key={chk.id}
                          id={`checklist-card-${chk.id}`}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                            isComplete
                              ? hasNonCompliance
                                ? 'bg-rose-50/20 border-rose-300 hover:border-rose-400'
                                : 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                              : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">{chk.title}</span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200" title={`Checklist Version ${chk.version || 'v1.0'} - Updated: ${chk.versionDate || 'Current'}`}>
                                {chk.version || 'v1.0'}
                              </span>
                              {isComplete ? (
                                (prog.missed > 0 || prog.incorrectlyExecuted > 0) ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>
                                      COMPLETED ({prog.missed > 0 ? `${prog.missed} MISSED` : ''}{prog.missed > 0 && prog.incorrectlyExecuted > 0 ? ', ' : ''}{prog.incorrectlyExecuted > 0 ? `${prog.incorrectlyExecuted} INCORRECTLY EXECUTED` : ''})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>COMPLETED</span>
                                  </span>
                                )
                              ) : prog.done > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  IN-PROGRESS ({prog.done}/{prog.total})
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  PENDING ({prog.total} items)
                                </span>
                              )}
                            </div>

                            {chk.description && (
                              <p className="text-xs text-slate-500 line-clamp-1">{chk.description}</p>
                            )}

                            {/* Completed By and Remarks snippet */}
                            {isComplete && (
                              <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                {chk.completedBy && (
                                  <span className="flex items-center gap-1 text-slate-700">
                                    <User className="w-3 h-3 text-sky-600" />
                                    <span>Signed: <strong>{chk.completedBy}</strong></span>
                                  </span>
                                )}
                                {chk.completedAt && (
                                  <span className="font-mono text-slate-500 font-medium">
                                    {new Date(chk.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </span>
                                )}
                                {hasNonCompliance && (
                                  <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px] font-bold">
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Non-Compliance Recorded: {prog.missed > 0 ? `${prog.missed} Missed` : ''}{prog.missed > 0 && prog.incorrectlyExecuted > 0 ? ', ' : ''}{prog.incorrectlyExecuted > 0 ? `${prog.incorrectlyExecuted} Incorrectly Executed` : ''}</span>
                                  </span>
                                )}
                                {chk.remarks && (
                                  <span className="italic text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px] truncate max-w-xs">
                                    &ldquo;{chk.remarks}&rdquo;
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons to Launch or Reset Checklist */}
                          <div className="shrink-0 flex items-center gap-2">
                            {onResetChecklist && (
                              <button
                                id={`btn-reset-checklist-${chk.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onResetChecklist(group, subGroup, chk);
                                }}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition text-xs font-bold flex items-center justify-center gap-1 shrink-0 shadow-2xs"
                                title={`Reset "${chk.title}" - mark all items back to Not Done`}
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Reset</span>
                              </button>
                            )}

                            <button
                              id={`btn-open-checklist-${chk.id}`}
                              type="button"
                              onClick={() => onOpenChecklist(group, subGroup, chk)}
                              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-2xs ${
                                isComplete
                                  ? 'bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{isComplete ? 'Review / Edit' : 'Execute Checklist'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
          )}
        </div>
      )}
    </div>
  );
}
