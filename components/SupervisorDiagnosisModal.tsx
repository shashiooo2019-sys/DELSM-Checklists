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
  dayShiftOnly?: boolean;
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
  dayShiftOnly = false,
  onClose,
  onVerifyGroup,
  onReopenGroup,
  onCloseShift,
  onReopenShift,
}: SupervisorDiagnosisModalProps) {
  const groupsList = dayShiftOnly
    ? dayData.groups.filter((g) => g.name.includes('Day Shift') || g.code === 'DAY-OPS')
    : dayData.groups.filter((g) => !g.name.includes('Day Shift') && g.code !== 'DAY-OPS');

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    targetGroupId || groupsList[0]?.id || ''
  );
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');
  const [verifiedExceptions, setVerifiedExceptions] = useState<boolean>(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState<boolean>(false);
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);
  const [isTabsFrameExpanded, setIsTabsFrameExpanded] = useState<boolean>(false);

  // Sign-off details - Pre-fill with active logged in user credentials if available
  const [signoffUNumber, setSignoffUNumber] = useState<string>(currentUser?.uNumber || '');
  const [signoffName, setSignoffName] = useState<string>(currentUser?.name || '');
  const [shiftClosureRemarks, setShiftClosureRemarks] = useState<string>('');

  if (!isOpen) return null;

  const currentGroup = groupsList.find((g) => g.id === selectedGroupId) || groupsList[0];
  const overall = getDayOverallProgress(dayData);
  const isGroupReady = currentGroup ? isGroupComplete(currentGroup) : false;
  const canCloseShift = dayShiftOnly
    ? (currentGroup ? isGroupComplete(currentGroup) : false)
    : overall.completedGroups === overall.totalGroups;

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
    if (dayShiftOnly && currentGroup) {
      const finalNotes = `Day Shift Sign-off by: ${signoffName.trim()} (U-Number: ${signoffUNumber.trim()})\nRemarks: ${shiftClosureRemarks.trim() || 'Day Shift verified and closed independently.'}`;
      onVerifyGroup(currentGroup.id, finalNotes);
    } else {
      const finalNotes = `Sign-off by: ${signoffName.trim()} (U-Number: ${signoffUNumber.trim()})\nRemarks: ${shiftClosureRemarks.trim() || 'Full shift verified and closed by Duty Supervisor.'}`;
      onCloseShift(finalNotes);
    }
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
                  {dayShiftOnly ? 'Day Shift (Duty 2) - Supervisor Verification & Closure' : 'Supervisor Diagnosis & Verification Control'}
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
        {/* Collapsible Frame for Operational Groups of Checklists Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <button
            id="btn-toggle-groups-tabs-frame"
            type="button"
            onClick={() => setIsTabsFrameExpanded(!isTabsFrameExpanded)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200 shadow-2xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sky-700">Current Tab: {currentGroup?.name}</span>
              <span className="text-[11px] text-slate-500 font-normal">({groupsList.length} groups)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-bold">
                {isTabsFrameExpanded ? 'Collapse Operational Groups of Checklists' : 'Expand Operational Groups of Checklists'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isTabsFrameExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isTabsFrameExpanded && (
            <div className="mt-2.5 p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-2 animate-in fade-in">
              {groupsList.map((grp) => {
                const isComplete = isGroupComplete(grp);
                const isSelected = grp.id === currentGroup?.id;
                return (
                  <button
                    key={grp.id}
                    id={`btn-select-diagnosis-group-${grp.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(grp.id);
                      setIsTabsFrameExpanded(false); // Collapse after selection
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
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
          )}
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
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span>Shift Verified & Closed · {currentGroup.verifiedBy || 'Supervisor'}</span>
                      </div>
                      {(currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN') && (
                        <button
                          id="btn-overview-reopen-group"
                          type="button"
                          onClick={() => {
                            if (!showReopenConfirm) {
                              setShowReopenConfirm(true);
                              setTimeout(() => setShowReopenConfirm(false), 5000);
                            } else {
                              handleReopen();
                              setShowReopenConfirm(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                            showReopenConfirm
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-600 animate-pulse font-extrabold'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                          }`}
                          title={dayShiftOnly ? 'Reopen Day Shift Operations for rework' : 'Reopen this group for rework'}
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{showReopenConfirm ? 'Confirm Reopen?' : (dayShiftOnly ? 'Reopen Day Shift' : 'Reopen Group')}</span>
                        </button>
                      )}
                    </div>
                  ) : isGroupReady ? (
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>Ready for Shift Verification & Closure</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{pendingItemsList.length} Checks In-Progress / Pending</span>
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

              {/* Section 4: Individual Group Authorization (Only for multi-group navigation) */}
              {!dayShiftOnly && (
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <span>Individual Tab Sign-off Authority: {currentGroup.name}</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Supervisor Tab Notes:
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
                      <span>{currentGroup.isVerified ? 'Update Tab Verification' : 'Authorize & Lock Tab'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Shift Closure Sign-off Section followed by Verify and Accept Skipped or Not Done Items & Button */}
        {!(dayShiftOnly ? currentGroup?.isVerified : dayData.isShiftClosed) ? (() => {
          // Calculate all skipped and incomplete/not done items across target scope
          const targetGroupsList = dayShiftOnly
            ? (currentGroup ? [currentGroup] : groupsList)
            : (dayData.groups || []).filter(g => !g.name.includes('Day Shift') && g.code !== 'DAY-OPS');

          const allExceptionsList: { groupName: string; subName: string; chkTitle: string; itemText: string; status: string; reason?: string }[] = [];
          
          for (const grp of targetGroupsList) {
            for (const sub of grp.subGroups || []) {
              for (const chk of sub.checklists || []) {
                for (const item of chk.items || []) {
                  if (item.status === 'skipped' || item.status === 'not_done' || item.status === 'pinned') {
                    allExceptionsList.push({
                      groupName: grp.name,
                      subName: sub.name,
                      chkTitle: chk.title,
                      itemText: item.text,
                      status: item.status,
                      reason: item.skipReason,
                    });
                  }
                }
              }
            }
          }

          const hasExceptions = allExceptionsList.length > 0;
          const skippedCount = allExceptionsList.filter(e => e.status === 'skipped').length;
          const notDoneCount = allExceptionsList.filter(e => e.status === 'not_done' || e.status === 'pinned').length;
          
          const isBlocked = (hasExceptions && !verifiedExceptions) || signoffUNumber.trim() === '' || signoffName.trim() === '';

          return (
            <div className="bg-slate-50 border-t border-slate-200 divide-y divide-slate-200">
              {/* Step 1: Shift Closure Sign-off Details */}
              <div className="p-4 sm:p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{dayShiftOnly ? 'Day Shift Closure Sign-off' : 'Shift Closure Sign-off'}</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">Supervisor Authorization Required</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      U-Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-signoff-unumber"
                      type="text"
                      placeholder="e.g. U12345"
                      value={signoffUNumber}
                      onChange={(e) => setSignoffUNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-signoff-name"
                      type="text"
                      placeholder="e.g. John Doe (Duty Supervisor)"
                      value={signoffName}
                      onChange={(e) => setSignoffName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Final Handover Remarks (Optional)
                    </label>
                    <input
                      id="input-signoff-remarks"
                      type="text"
                      placeholder="e.g. Operations executed smoothly, shift handed over."
                      value={shiftClosureRemarks}
                      onChange={(e) => setShiftClosureRemarks(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Verify and Accept Skipped or Not Done Items (After Shift Closure Sign-off) */}
              <div className="p-4 sm:p-5 bg-amber-50/70 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <h5 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Verify & Accept Exceptions (Skipped or Not Done Items)
                    </h5>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-md font-mono text-[11px] font-bold">
                      {skippedCount} Skipped
                    </span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-200 rounded-md font-mono text-[11px] font-bold">
                      {notDoneCount} Not Done
                    </span>
                  </div>
                </div>

                {hasExceptions ? (
                  <div className="space-y-2">
                    <div className="max-h-32 overflow-y-auto border border-amber-200 rounded-xl p-2.5 bg-white space-y-1.5 divide-y divide-slate-100">
                      {allExceptionsList.map((exc, eIdx) => (
                        <div key={eIdx} className="pt-1.5 first:pt-0 flex items-start justify-between text-xs gap-2">
                          <div className="space-y-0.5">
                            <span className="text-slate-800 font-medium">
                              <strong className="text-slate-900">[{exc.chkTitle}]</strong> {exc.itemText}
                            </span>
                            {exc.reason && (
                              <p className="text-[11px] text-amber-800 italic">Reason: {exc.reason}</p>
                            )}
                          </div>
                          <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-bold shrink-0 ${
                            exc.status === 'skipped'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {exc.status === 'skipped' ? 'SKIPPED' : 'NOT DONE'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Checkbox to verify and accept skipped or not done items */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2.5 font-bold text-xs text-amber-950 cursor-pointer select-none bg-white p-3 rounded-xl border border-amber-300 shadow-2xs hover:bg-amber-50/50 transition">
                        <input
                          id="chk-verify-exceptions"
                          type="checkbox"
                          checked={verifiedExceptions}
                          onChange={(e) => setVerifiedExceptions(e.target.checked)}
                          className="w-4 h-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Verify and accept skipped or not done items</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All checklist items executed and complete. Zero skipped or not done exceptions found.</span>
                  </div>
                )}

                {/* Step 3: Button for Shift Verify and Close (directly following checkbox) */}
                <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-[11px] text-slate-500">
                    {isBlocked 
                      ? hasExceptions && !verifiedExceptions 
                        ? 'Check the box above to accept skipped / not done items.'
                        : 'Please enter Supervisor U-Number and Name above.'
                      : 'All requirements satisfied. Ready to finalize.'}
                  </span>

                  <button
                    id="btn-shift-verify-and-close"
                    type="button"
                    disabled={isBlocked}
                    onClick={handleShiftCloseAction}
                    className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition cursor-pointer ${
                      isBlocked
                        ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{dayShiftOnly ? 'Shift Verify and Close' : 'Shift Verify and Close'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })() : (
          <div className="p-5 bg-emerald-50 border-t border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-emerald-950">
                  {dayShiftOnly ? 'Day Shift Operations Verified and Closed' : 'Shift Verified and Closed'}
                </div>
                <div className="text-xs text-emerald-800 font-normal">
                  {dayShiftOnly 
                    ? `Day Shift Operations closed & verified by ${currentGroup?.verifiedBy || 'Supervisor'}.`
                    : `Operational shift closed & verified by ${dayData.closedBy || 'Supervisor'}.`}
                </div>
              </div>
            </div>

            {(currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN') && (
              <button
                id="btn-reopen-entire-shift"
                type="button"
                onClick={() => {
                  if (!showReopenConfirm) {
                    setShowReopenConfirm(true);
                    setTimeout(() => setShowReopenConfirm(false), 5000);
                  } else {
                    if (dayShiftOnly && currentGroup) {
                      handleReopen();
                    } else if (onReopenShift) {
                      onReopenShift();
                    }
                    setShowReopenConfirm(false);
                  }
                }}
                className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
                  showReopenConfirm
                    ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-slate-950 animate-pulse font-extrabold'
                    : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>
                  {showReopenConfirm 
                    ? (dayShiftOnly ? 'Confirm Reopen Day Shift?' : 'Confirm Reopen Shift?') 
                    : (dayShiftOnly ? 'Reopen Day Shift Operations' : 'Reopen for Rework')}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
