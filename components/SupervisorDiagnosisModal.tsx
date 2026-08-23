'use client';

import React, { useState } from 'react';
import { DayOperationalData, OperationalGroup, UserAccount } from '@/types/aviation';
import { isGroupComplete, getDayOverallProgress } from '@/lib/storage';
import { 
  X,
  ChevronDown, 
  Stethoscope, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Clock, 
  FileText, 
  Check, 
  MessageSquare,
  Sparkles,
  Plane
} from 'lucide-react';

interface SupervisorDiagnosisModalProps {
  isOpen: boolean;
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  targetGroupId?: string;
  onClose: () => void;
  onVerifyGroup: (groupId: string, notes?: string) => void;
  onReopenGroup: (groupId: string) => void;
  onCloseShift: (notes?: string) => void;
  onReopenShift?: () => void;
}

export function SupervisorDiagnosisModal({
  isOpen,
  dayData,
  currentUser,
  targetGroupId,
  onClose,
  onVerifyGroup,
  onReopenGroup,
  onCloseShift,
  onReopenShift,
}: SupervisorDiagnosisModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    targetGroupId || dayData.groups[0]?.id || ''
  );
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');
  const [verifiedExceptions, setVerifiedExceptions] = useState<boolean>(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState<boolean>(false);
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);

  // Sign-off details
  const [signoffUNumber, setSignoffUNumber] = useState<string>('');
  const [signoffName, setSignoffName] = useState<string>('');
  const [shiftClosureRemarks, setShiftClosureRemarks] = useState<string>('');

  if (!isOpen) return null;

  const currentGroup = dayData.groups.find((g) => g.id === selectedGroupId) || dayData.groups[0];
  const overall = getDayOverallProgress(dayData);
  const isGroupReady = currentGroup ? isGroupComplete(currentGroup) : false;
  const canCloseShift = overall.completedGroups === overall.totalGroups;

  // Gather diagnosis insights for currentGroup
  const skippedItemsList: { subName: string; chkTitle: string; text: string; reason?: string; actionBy?: string }[] = [];
  const remarksList: { subName: string; chkTitle: string; remarks: string; completedBy?: string; completedAt?: string }[] = [];
  const pendingItemsList: { subName: string; chkTitle: string; text: string; isMandatory: boolean }[] = [];

  if (currentGroup) {
    for (const sub of currentGroup.subGroups) {
      for (const chk of sub.checklists) {
        if (chk.remarks) {
          remarksList.push({
            subName: sub.name,
            chkTitle: chk.title,
            remarks: chk.remarks,
            completedBy: chk.completedBy,
            completedAt: chk.completedAt,
          });
        }
        for (const item of chk.items) {
          if (item.status === 'skipped') {
            skippedItemsList.push({
              subName: sub.name,
              chkTitle: chk.title,
              text: item.text,
              reason: item.skipReason,
              actionBy: item.actionBy,
            });
          } else if (item.status === 'not_done' || item.status === 'pinned') {
            pendingItemsList.push({
              subName: sub.name,
              chkTitle: chk.title,
              text: item.text,
              isMandatory: item.isMandatory,
            });
          }
        }
      }
    }
  }

  const handleVerify = () => {
    if (!currentGroup) return;
    onVerifyGroup(currentGroup.id, supervisorNotes);
    setSupervisorNotes('');
  };

  const handleReopen = () => {
    if (!currentGroup) return;
    onReopenGroup(currentGroup.id);
  };

  const handleShiftCloseAction = () => {
    const finalNotes = `Sign-off by: ${signoffName.trim()} (U-Number: ${signoffUNumber.trim()})\nRemarks: ${shiftClosureRemarks.trim() || 'Full shift verified and closed by Duty Supervisor.'}`;
    onCloseShift(finalNotes);
    setSupervisorNotes('');
    setSignoffUNumber('');
    setSignoffName('');
    setShiftClosureRemarks('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div 
        id="supervisor-diagnosis-modal-container"
        className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl my-auto text-slate-900 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Supervisor Diagnosis & Verification Control
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  AUTH LEVEL: SUPERVISOR
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Shift: <span className="font-mono text-slate-700 font-semibold">{dayData.date}</span> · Auditor: <span className="text-amber-800 font-semibold">{currentUser?.name}</span>
              </p>
            </div>
          </div>

          <button
            id="btn-close-diagnosis"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Group Selector Navigation Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <button 
            type="button" 
            onClick={() => setIsNavExpanded(!isNavExpanded)}
            className="flex sm:hidden items-center justify-between w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-sm"
          >
            <span>Viewing: <span className="font-mono text-sky-700">{currentGroup?.name}</span></span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isNavExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`sm:flex items-center sm:overflow-x-auto flex-nowrap gap-2 sm:[scrollbar-width:none] sm:[-ms-overflow-style:none] sm:[&::-webkit-scrollbar]:hidden ${isNavExpanded ? 'flex flex-col items-stretch max-h-48 overflow-y-auto' : 'hidden'}`}>
            {dayData.groups.map((grp) => {
              const isComplete = isGroupComplete(grp);
              const isSelected = grp.id === currentGroup?.id;
              return (
                <button
                  key={grp.id}
                  id={`btn-select-diagnosis-group-${grp.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedGroupId(grp.id);
                    setIsNavExpanded(false); // Auto-collapse on selection on mobile
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between sm:justify-start gap-1.5 whitespace-nowrap transition shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400'
                      : grp.isVerified
                      ? 'bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100'
                      : isComplete
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{grp.name}</span>
                  <div className="flex items-center gap-1">
                    {grp.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-sky-700 shrink-0" />}
                    {!grp.isVerified && isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 bg-slate-50/50">
          {currentGroup ? (
            <div className="space-y-6">
              {/* Group Overview Banner */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{currentGroup.name}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                      {currentGroup.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Category: {currentGroup.isFlightGroup ? 'Flight Turnaround' : 'Ground Infrastructure'} · Sub-Operations: {currentGroup.subGroups.length}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentGroup.isVerified ? (
                    <div className="px-3 py-1.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                      <Lock className="w-4 h-4 text-sky-600" />
                      <span>Verified by {currentGroup.verifiedBy || 'Supervisor'}</span>
                    </div>
                  ) : isGroupReady ? (
                    <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Ready for Supervisor Authorization</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{pendingItemsList.length} Checks Still Pending</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 1: User Remarks & Handover Notes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Operator Sign-off Remarks ({remarksList.length})</span>
                </h4>

                {remarksList.length === 0 ? (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 italic">
                    No checklists signed off yet for this group.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {remarksList.map((rem, idx) => (
                      <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <span className="font-bold text-slate-900">{rem.chkTitle}</span>
                          <span className="text-slate-500 text-[11px]">
                            {rem.completedBy && <span>Signed by: <strong className="text-slate-700">{rem.completedBy}</strong></span>}
                            {rem.completedAt && <span className="ml-2 font-mono text-slate-400">{new Date(rem.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-900 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                          &ldquo;{rem.remarks}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Skipped Items Audit */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Optional Skipped Items Audit ({skippedItemsList.length})</span>
                </h4>

                {skippedItemsList.length === 0 ? (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Zero skipped items. All applicable checks were executed directly.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {skippedItemsList.map((skip, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-amber-900 font-bold">
                          <span>{skip.chkTitle}</span>
                          <span className="text-[11px] text-slate-500">{skip.actionBy}</span>
                        </div>
                        <p className="text-slate-800 font-medium">{skip.text}</p>
                        {skip.reason && (
                          <p className="text-amber-800 italic text-[11px]">Reason: {skip.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Pending Incomplete Items */}
              {pendingItemsList.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600" />
                    <span>Incomplete Checks Remaining ({pendingItemsList.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {pendingItemsList.map((pend, idx) => (
                      <div key={idx} className="p-2.5 bg-white border border-rose-200 rounded-xl text-xs flex items-center justify-between shadow-2xs">
                        <span className="text-slate-800">{pend.text}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pend.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {pend.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Supervisor Authorization Actions */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>Supervisor Sign-off Authority for {currentGroup.name}</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Supervisor Verification Log / Endorsement Notes:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified turnaround timeline, aircraft pushback on schedule, no discrepancies found."
                    value={supervisorNotes}
                    onChange={(e) => setSupervisorNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <div>
                    {currentGroup.isVerified ? (
                      <button
                        id="btn-reopen-group"
                        type="button"
                        onClick={handleReopen}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Reopen Group for Rework</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {isGroupReady
                          ? 'Group completed by ground crew. Authorize below.'
                          : 'Group has pending checks. Verification will stamp current state.'}
                      </span>
                    )}
                  </div>

                  <button
                    id="btn-authorize-group"
                    type="button"
                    onClick={handleVerify}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{currentGroup.isVerified ? 'Update Verification Stamp' : 'Authorize & Lock Group'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Exceptions Verification Banner when there are pending checklists */}
        {!dayData.isShiftClosed && (() => {
          const pendingChecklists: { groupName: string; subName: string; chkTitle: string; pendingItemsCount: number }[] = [];
          for (const grp of dayData.groups || []) {
            for (const sub of grp.subGroups || []) {
              for (const chk of sub.checklists || []) {
                // Exclude Duty 2 Checklist from exceptions since it's closed in a separate shift
                if (
                  (grp.name.includes('Day Shift')) &&
                  sub.name === 'General Operations' &&
                  chk.title === 'Duty 2 Checklist'
                ) {
                  continue;
                }

                if (chk.status !== 'completed') {
                  const incompleteCount = (chk.items || []).filter(
                    (item) => item.status === 'not_done' || item.status === 'pinned'
                  ).length;
                  pendingChecklists.push({
                    groupName: grp.name,
                    subName: sub.name,
                    chkTitle: chk.title,
                    pendingItemsCount: incompleteCount,
                  });
                }
              }
            }
          }

          if (pendingChecklists.length === 0) return null;

          return (
            <div className="px-4 sm:px-6 py-3 bg-amber-50 border-t border-b border-amber-200 text-amber-950 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="font-bold">
                    Shift Closure Exception: There are {pendingChecklists.length} pending / incomplete checklists remaining!
                  </p>
                  <div className="max-h-24 overflow-y-auto border border-amber-200 rounded-lg p-2 bg-white space-y-1 divide-y divide-slate-100">
                    {pendingChecklists.map((exc, eIdx) => (
                      <div key={eIdx} className="pt-1 first:pt-0 flex items-center justify-between text-[11px] text-slate-600">
                        <span>
                          <strong className="text-slate-800">[{exc.groupName}]</strong> &raquo; {exc.subName} &raquo; <strong className="text-slate-700">{exc.chkTitle}</strong>
                        </span>
                        <span className="font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-sm border border-amber-100 text-[10px]">
                          {exc.pendingItemsCount} pending
                        </span>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 font-semibold text-amber-950 cursor-pointer select-none">
                    <input
                      id="chk-verify-exceptions"
                      type="checkbox"
                      checked={verifiedExceptions}
                      onChange={(e) => setVerifiedExceptions(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Verify and acknowledge these pending checklist exceptions to authorize shift closure.</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Explicit Sign-off Section */}
        {!dayData.isShiftClosed && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Shift Closure Sign-off</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="U-Number (e.g. U12345)"
                value={signoffUNumber}
                onChange={(e) => setSignoffUNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={signoffName}
                onChange={(e) => setSignoffName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="Final Remarks (Optional)"
                value={shiftClosureRemarks}
                onChange={(e) => setShiftClosureRemarks(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        )}

        {/* Global Shift Closure Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Shift Progress: <strong className="text-slate-900 font-semibold">{overall.verifiedGroups}/{overall.totalGroups} groups verified</strong> · {overall.percent}% overall checks done
          </div>

          <div className="flex items-center gap-3">
            {!dayData.isShiftClosed ? (() => {
              const pendingChecklistsCount = (dayData.groups || []).flatMap(g => g.subGroups || []).flatMap(s => s.checklists || []).filter(c => c.status !== 'completed').length;
              const hasExceptions = pendingChecklistsCount > 0 && !verifiedExceptions;
              const isBlocked = hasExceptions || signoffUNumber.trim() === "" || signoffName.trim() === "";

              return (
                <button
                  id="btn-close-entire-shift"
                  type="button"
                  disabled={isBlocked}
                  onClick={handleShiftCloseAction}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition ${
                    isBlocked
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Official Shift Closure & Sign-off</span>
                </button>
              );
            })() : (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Operational Shift Officially Closed & Archived</span>
                </div>
                {(currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN') && onReopenShift && (
                  <button
                    id="btn-reopen-entire-shift"
                    type="button"
                    onClick={() => {
                      if (!showReopenConfirm) {
                        setShowReopenConfirm(true);
                        setTimeout(() => setShowReopenConfirm(false), 5000);
                      } else {
                        onReopenShift();
                        setShowReopenConfirm(false);
                      }
                    }}
                    className={`px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
                      showReopenConfirm
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-slate-950 animate-pulse font-extrabold'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                    }`}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{showReopenConfirm ? 'Confirm Reopen' : 'Reopen Shift'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
