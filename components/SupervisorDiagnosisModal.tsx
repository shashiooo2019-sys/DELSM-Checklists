'use client';

import React, { useState } from 'react';
import { DayOperationalData, OperationalGroup, UserAccount } from '@/types/aviation';
import { isGroupComplete, getDayOverallProgress } from '@/lib/storage';
import { 
  X,
  ChevronDown, 
  Stethoscope, 
  ShieldCheck, 
  ShieldAlert,
  HelpCircle,
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
  onCloseShift: (notes?: string, supervisorName?: string) => void;
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
  const [signoffUNumber, setSignoffUNumber] = useState<string>(() => currentUser?.uNumber || '');
  const [signoffName, setSignoffName] = useState<string>(() => currentUser?.name || '');
  const [shiftClosureRemarks, setShiftClosureRemarks] = useState<string>(() => 
    currentUser?.uNumber ? `Shift operational handover verified and signed off by ${currentUser.name} (${currentUser.uNumber}).` : ''
  );
  const [showShiftClosePromptModal, setShowShiftClosePromptModal] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentGroup = groupsList.find((g) => g.id === selectedGroupId) || groupsList[0];
  const overall = getDayOverallProgress(dayData);
  const isGroupReady = currentGroup ? (isGroupComplete(currentGroup) || currentGroup.isVerified || currentGroup.isSkipped) : false;
  const canCloseShift = dayShiftOnly
    ? (currentGroup ? (isGroupComplete(currentGroup) || currentGroup.isVerified || currentGroup.isSkipped) : false)
    : dayData.groups.filter(g => !g.name.includes('Day Shift') && g.code !== 'DAY-OPS').every(g => isGroupComplete(g) || g.isVerified || g.isSkipped);

  // Gather diagnosis insights for currentGroup
  const nonCompliantItemsList: { subName: string; chkTitle: string; text: string; status: 'missed' | 'incorrectly_executed'; remark?: string; actionBy?: string }[] = [];
  const mandatorySkippedList: { subName: string; chkTitle: string; text: string; reason?: string; actionBy?: string }[] = [];
  const optionalSkippedList: { subName: string; chkTitle: string; text: string; reason?: string; actionBy?: string }[] = [];
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
          if (item.status === 'missed' || item.status === 'incorrectly_executed') {
            nonCompliantItemsList.push({
              subName: sub.name,
              chkTitle: chk.title,
              text: item.text,
              status: item.status,
              remark: item.remark,
              actionBy: item.actionBy,
            });
          } else if (item.status === 'skipped') {
            if (item.isMandatory) {
              mandatorySkippedList.push({
                subName: sub.name,
                chkTitle: chk.title,
                text: item.text,
                reason: item.skipReason,
                actionBy: item.actionBy,
              });
            } else {
              optionalSkippedList.push({
                subName: sub.name,
                chkTitle: chk.title,
                text: item.text,
                reason: item.skipReason,
                actionBy: item.actionBy,
              });
            }
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
      onCloseShift(finalNotes, signoffName.trim());
    }
    setSupervisorNotes('');
    setSignoffUNumber('');
    setSignoffName('');
    setShiftClosureRemarks('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div 
        id="supervisor-diagnosis-modal-container"
        className="w-full max-w-4xl box-3d my-auto text-slate-900 overflow-hidden shadow-[0_25px_60px_-10px_rgba(0,0,0,0.45)]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-300 flex items-center justify-between shrink-0 shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shadow-2xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {dayShiftOnly ? 'Day Shift (Duty 2) - Supervisor Verification & Closure' : 'Supervisor Diagnosis & Verification Control'}
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black shadow-2xs">
                  AUTH LEVEL: SUPERVISOR
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Shift: <span className="font-mono text-slate-900 font-bold">{dayData.date}</span> · Auditor: <span className="text-amber-900 font-bold">{currentUser?.name}</span>
              </p>
            </div>
          </div>

          <button
            id="btn-close-diagnosis"
            onClick={onClose}
            className="btn-3d-white p-1.5 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>
        {/* Collapsible Frame for Operational Groups of Checklists Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100 border-b border-slate-300 shrink-0">
          <button
            id="btn-toggle-groups-tabs-frame"
            type="button"
            onClick={() => setIsTabsFrameExpanded(!isTabsFrameExpanded)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 btn-3d-white rounded-xl text-xs font-black transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sky-800">Current Tab: {currentGroup?.name}</span>
              <span className="text-[11px] text-slate-500 font-bold">({groupsList.length} groups)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 font-black">
                {isTabsFrameExpanded ? 'Collapse Operational Groups' : 'Expand Operational Groups'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isTabsFrameExpanded ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isTabsFrameExpanded && (
            <div className="mt-2.5 p-3 bg-white border border-slate-300 rounded-xl flex flex-wrap gap-2 animate-in fade-in shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'btn-3d-amber ring-2 ring-amber-400'
                        : grp.isVerified
                        ? 'btn-3d-blue'
                        : isComplete
                        ? 'btn-3d-emerald'
                        : 'btn-3d-white text-slate-700'
                    }`}
                  >
                    <span>{grp.name}</span>
                    <div className="flex items-center gap-1">
                      {grp.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-sky-800 shrink-0" />}
                      {!grp.isVerified && isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>



        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 bg-slate-100/60">
          {currentGroup ? (
            <div className="space-y-6">
              {/* Group Overview Banner */}
              <div className="p-4 box-3d flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{currentGroup.name}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-bold">
                      {currentGroup.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Category: {currentGroup.isFlightGroup ? 'Flight Turnaround' : 'Ground Infrastructure'} · Sub-Operations: {currentGroup.subGroups.length}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentGroup.isVerified ? (
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xs">
                        <Lock className="w-4 h-4 text-emerald-700" />
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                            showReopenConfirm
                              ? 'btn-3d-amber animate-pulse'
                              : 'btn-3d-rose'
                          }`}
                          title={dayShiftOnly ? 'Reopen Day Shift Operations for rework' : 'Reopen this group for rework'}
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{showReopenConfirm ? 'Confirm Reopen?' : (dayShiftOnly ? 'Reopen Day Shift' : 'Reopen Group')}</span>
                        </button>
                      )}
                    </div>
                  ) : isGroupReady ? (
                    <div className="px-3 py-1.5 bg-sky-100 text-sky-950 border border-sky-300 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-sky-700" />
                      <span>Ready for Shift Verification & Closure</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xs">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>{pendingItemsList.length} Checks In-Progress / Pending</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 1: User Remarks & Handover Notes */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>Operator Sign-off Remarks ({remarksList.length})</span>
                </h4>

                {remarksList.length === 0 ? (
                  <div className="p-4 box-3d text-xs text-slate-500 italic">
                    No checklists signed off yet for this group.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {remarksList.map((rem, idx) => (
                      <div key={idx} className="p-3.5 box-3d space-y-1.5">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <span className="font-black text-slate-900">{rem.chkTitle}</span>
                          <span className="text-slate-600 text-[11px] font-medium">
                            {rem.completedBy && <span>Signed by: <strong className="text-slate-900 font-bold">{rem.completedBy}</strong></span>}
                            {rem.completedAt && <span className="ml-2 font-mono text-slate-500">{new Date(rem.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-950 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-300 leading-relaxed font-medium">
                          &ldquo;{rem.remarks}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2A: Non-Compliant Items Audit (Missed / Incorrectly Executed) */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Non-Compliant Items Audit ({nonCompliantItemsList.length})</span>
                </h4>

                {nonCompliantItemsList.length === 0 ? (
                  <div className="p-3.5 box-3d text-xs text-emerald-900 bg-emerald-50/60 border-emerald-300 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero non-compliance events recorded. All completed items adhered to airside operating standards.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nonCompliantItemsList.map((item, idx) => (
                      <div key={idx} className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-rose-950 font-black">
                          <span>{item.chkTitle} <span className="text-slate-500 font-normal">({item.subName})</span></span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'missed' ? 'bg-rose-200 text-rose-950 border border-rose-400' : 'bg-amber-200 text-amber-950 border border-amber-400'
                          }`}>
                            {item.status === 'missed' ? 'MISSED ❌' : 'INCORRECTLY EXECUTED ⚠️'}
                          </span>
                        </div>
                        <p className="text-slate-900 font-bold text-xs">{item.text}</p>
                        {item.remark && (
                          <div className="p-2 bg-white rounded-lg border border-rose-200 text-[11px] text-rose-950 font-mono">
                            <span className="font-bold">Operator Remark:</span> {item.remark}
                            {item.actionBy && <span className="ml-2 text-slate-500 font-sans">({item.actionBy})</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2B: Mandatory Items Skipped Audit */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Mandatory Items Skipped Audit ({mandatorySkippedList.length})</span>
                </h4>

                {mandatorySkippedList.length === 0 ? (
                  <div className="p-3.5 box-3d text-xs text-emerald-900 bg-emerald-50/60 border-emerald-300 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero mandatory items bypassed. 100% of required ground safety checks were verified.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mandatorySkippedList.map((item, idx) => (
                      <div key={idx} className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-amber-950 font-black">
                          <span>{item.chkTitle} <span className="text-slate-500 font-normal">({item.subName})</span></span>
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-400 text-[10px] font-black uppercase tracking-wider">
                            MANDATORY SAFETY BYPASS
                          </span>
                        </div>
                        <p className="text-slate-900 font-bold text-xs">{item.text}</p>
                        <div className="p-2 bg-white rounded-lg border border-amber-200 text-[11px] text-amber-950 font-medium">
                          <span className="font-bold text-amber-900">Operational Reason / Justification:</span> {item.reason || 'Bypassed by operator'}
                          {item.actionBy && <span className="ml-2 text-slate-500 font-sans">({item.actionBy})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2C: Optional Skipped Items Audit */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Optional Skipped Items Audit ({optionalSkippedList.length})</span>
                </h4>

                {optionalSkippedList.length === 0 ? (
                  <div className="p-3.5 box-3d text-xs text-slate-700 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Zero optional skipped items. All applicable optional checks were executed directly.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {optionalSkippedList.map((skip, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between text-slate-950 font-bold">
                          <span>{skip.chkTitle}</span>
                          <span className="text-[11px] text-slate-500 font-normal">{skip.actionBy}</span>
                        </div>
                        <p className="text-slate-800">{skip.text}</p>
                        {skip.reason && (
                          <p className="text-slate-600 italic text-[11px]">Reason: {skip.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Pending Incomplete Items */}
              {pendingItemsList.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-700" />
                    <span>Incomplete Checks Remaining ({pendingItemsList.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {pendingItemsList.map((pend, idx) => (
                      <div key={idx} className="p-2.5 box-3d text-xs flex items-center justify-between border-rose-300">
                        <span className="text-slate-900 font-medium">{pend.text}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pend.isMandatory ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
                          {pend.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Individual Group Authorization (Only for multi-group navigation) */}
              {!dayShiftOnly && (
                <div className="p-5 box-3d space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-700" />
                    <span>Individual Tab Sign-off Authority: {currentGroup.name}</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1.5">
                      Supervisor Tab Notes:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Verified turnaround timeline, aircraft pushback on schedule, no discrepancies found."
                      value={supervisorNotes}
                      onChange={(e) => setSupervisorNotes(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] font-semibold transition"
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                    <div>
                      {currentGroup.isVerified ? (
                        <button
                          id="btn-reopen-group"
                          type="button"
                          onClick={handleReopen}
                          className="btn-3d-rose px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Reopen Group for Rework</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600 font-medium">
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
                      className="btn-3d-blue px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
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
            : (dayData.groups || []).filter(g => !g.name.includes('Day Shift') && g.code !== 'DAY-OPS' && !g.isVerified && !g.isSkipped);

          const allExceptionsList: { 
            groupName: string; 
            subName: string; 
            chkTitle: string; 
            itemText: string; 
            status: string; 
            reason?: string;
            remark?: string;
            isMandatory?: boolean;
          }[] = [];
          
          for (const grp of targetGroupsList) {
            for (const sub of grp.subGroups || []) {
              for (const chk of sub.checklists || []) {
                for (const item of chk.items || []) {
                  if (item.status === 'skipped' || item.status === 'not_done' || item.status === 'pinned' || item.status === 'missed' || item.status === 'incorrectly_executed') {
                    allExceptionsList.push({
                      groupName: grp.name,
                      subName: sub.name,
                      chkTitle: chk.title,
                      itemText: item.text,
                      status: item.status,
                      reason: item.skipReason,
                      remark: item.remark,
                      isMandatory: item.isMandatory,
                    });
                  }
                }
              }
            }
          }

          const hasExceptions = allExceptionsList.length > 0;
          const mandatorySkippedCount = allExceptionsList.filter(e => e.status === 'skipped' && e.isMandatory).length;
          const optionalSkippedCount = allExceptionsList.filter(e => e.status === 'skipped' && !e.isMandatory).length;
          const nonCompliantCount = allExceptionsList.filter(e => e.status === 'missed' || e.status === 'incorrectly_executed').length;
          const notDoneCount = allExceptionsList.filter(e => e.status === 'not_done' || e.status === 'pinned').length;
          
          const isBlocked = (hasExceptions && !verifiedExceptions) || signoffUNumber.trim() === '' || signoffName.trim() === '';

          return (
            <div className="bg-slate-100 border-t border-slate-300 divide-y divide-slate-300">
              {/* Step 1: Shift Closure Sign-off Details */}
              <div className="p-4 sm:p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>{dayShiftOnly ? 'Day Shift Closure Sign-off' : 'Shift Closure Sign-off'}</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono font-bold">Supervisor Authorization Required</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      Username / U-Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-signoff-unumber"
                      type="text"
                      placeholder="e.g. U123456"
                      value={signoffUNumber}
                      onChange={(e) => setSignoffUNumber(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-signoff-name"
                      type="text"
                      placeholder="e.g. Duty Supervisor"
                      value={signoffName}
                      onChange={(e) => setSignoffName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-slate-700 mb-1">
                      Free Text Remarks & Handover Notes
                    </label>
                    <textarea
                      id="input-signoff-remarks"
                      rows={2}
                      placeholder="Enter free text remarks, operational delays, handover notes, or observations..."
                      value={shiftClosureRemarks}
                      onChange={(e) => setShiftClosureRemarks(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition resize-y min-h-[50px]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Verify and Accept Exceptions (Skipped, Non-Compliant, or Incomplete Items) */}
              <div className="p-4 sm:p-5 bg-amber-50/90 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Verify & Accept Exceptions (Skipped, Non-Compliant, or Not Done)
                    </h5>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    {mandatorySkippedCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-950 border border-amber-400 rounded-md font-mono text-[11px] font-black shadow-2xs">
                        ⚠️ {mandatorySkippedCount} Mand. Skipped
                      </span>
                    )}
                    {nonCompliantCount > 0 && (
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-950 border border-rose-400 rounded-md font-mono text-[11px] font-black shadow-2xs">
                        ❌ {nonCompliantCount} Non-Compliant
                      </span>
                    )}
                    {optionalSkippedCount > 0 && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-900 border border-slate-300 rounded-md font-mono text-[11px] font-bold shadow-2xs">
                        {optionalSkippedCount} Opt. Skipped
                      </span>
                    )}
                    {notDoneCount > 0 && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-950 border border-rose-300 rounded-md font-mono text-[11px] font-black shadow-2xs">
                        {notDoneCount} Incomplete
                      </span>
                    )}
                  </div>
                </div>

                {hasExceptions ? (
                  <div className="space-y-2">
                    <div className="max-h-44 overflow-y-auto border border-amber-300 rounded-xl p-2.5 bg-white space-y-1.5 divide-y divide-slate-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
                      {allExceptionsList.map((exc, eIdx) => (
                        <div key={eIdx} className="pt-1.5 first:pt-0 flex items-start justify-between text-xs gap-2">
                          <div className="space-y-0.5">
                            <span className="text-slate-800 font-medium">
                              <strong className="text-slate-950 font-bold">[{exc.chkTitle}]</strong> {exc.itemText}
                            </span>
                            {exc.reason && (
                              <p className="text-[11px] text-amber-900 italic font-semibold">
                                Reason: {exc.reason}
                              </p>
                            )}
                            {exc.remark && (
                              <p className="text-[11px] text-rose-900 font-mono">
                                Remark: {exc.remark}
                              </p>
                            )}
                          </div>
                          <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm font-black shrink-0 ${
                            exc.status === 'skipped' && exc.isMandatory
                              ? 'bg-amber-200 text-amber-950 border border-amber-400'
                              : exc.status === 'skipped'
                              ? 'bg-slate-100 text-slate-800 border border-slate-300'
                              : exc.status === 'missed' || exc.status === 'incorrectly_executed'
                              ? 'bg-rose-200 text-rose-950 border border-rose-400'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {exc.status === 'skipped' && exc.isMandatory
                              ? 'MAND. SKIP ⚠️'
                              : exc.status === 'skipped'
                              ? 'SKIPPED'
                              : exc.status === 'missed'
                              ? 'MISSED ❌'
                              : exc.status === 'incorrectly_executed'
                              ? 'INCORRECT ⚠️'
                              : 'NOT DONE'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Checkbox to verify and accept skipped or not done items */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2.5 font-black text-xs text-amber-950 cursor-pointer select-none bg-white p-3 rounded-xl border border-amber-300 shadow-2xs hover:bg-amber-50/50 transition">
                        <input
                          id="chk-verify-exceptions"
                          type="checkbox"
                          checked={verifiedExceptions}
                          onChange={(e) => setVerifiedExceptions(e.target.checked)}
                          className="w-4 h-4 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>Verify and accept skipped, non-compliant, or incomplete items</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center gap-2 font-bold shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>All checklist items executed and compliant. Zero skipped or non-compliant exceptions recorded.</span>
                  </div>
                )}

                {/* Step 3: Button for Shift Verify and Close (directly following checkbox) */}
                <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-[11px] text-slate-600 font-semibold">
                    {isBlocked 
                      ? hasExceptions && !verifiedExceptions 
                        ? 'Check the box above to accept skipped / not done items.'
                        : 'Please enter Username and Name above.'
                      : 'All requirements satisfied. Ready to finalize.'}
                  </span>

                  <button
                    id="btn-shift-verify-and-close"
                    type="button"
                    disabled={isBlocked}
                    onClick={() => setShowShiftClosePromptModal(true)}
                    className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer ${
                      isBlocked
                        ? 'btn-3d-white text-slate-400 opacity-60 cursor-not-allowed'
                        : 'btn-3d-emerald'
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
          <div className="p-5 bg-emerald-100/90 border-t border-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-emerald-950 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <div className="text-sm font-black text-emerald-950">
                  {dayShiftOnly ? 'Day Shift Operations Verified and Closed' : 'Shift Verified and Closed'}
                </div>
                <div className="text-xs text-emerald-900 font-medium">
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
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  showReopenConfirm
                    ? 'btn-3d-amber animate-pulse'
                    : 'btn-3d-rose'
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
        {/* Prompt Modal for Username & Free Text on Shift Verify and Close */}
        {showShiftClosePromptModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
            <div 
              id="modal-shift-close-prompt"
              className="bg-white rounded-2xl border border-slate-300 shadow-[0_25px_60px_-10px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden text-slate-900 animate-in zoom-in-95"
            >
              <div className="p-4 sm:p-5 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600/30 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">
                      {dayShiftOnly ? 'Day Shift Verify & Close Authorization' : 'Shift Verify & Close Authorization'}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-900/80">
                      Shift Date: {dayData.date}
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-shift-prompt-x"
                  type="button"
                  onClick={() => setShowShiftClosePromptModal(false)}
                  className="p-1 rounded-lg hover:bg-amber-600/30 text-slate-950 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Please prompt and verify your username and enter any free text handover remarks to authorize and permanently lock the operational shift record.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Username / U-Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="prompt-shift-close-unumber"
                        type="text"
                        required
                        placeholder="e.g. U123456"
                        value={signoffUNumber}
                        onChange={(e) => setSignoffUNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Full Name / Role <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="prompt-shift-close-name"
                      type="text"
                      required
                      placeholder="e.g. Duty Supervisor"
                      value={signoffName}
                      onChange={(e) => setSignoffName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Free Text Remarks & Handover Notes
                    </label>
                    <div className="relative">
                      <textarea
                        id="prompt-shift-close-remarks"
                        rows={3}
                        placeholder="Enter free text notes, operational observations, log handovers, or delay explanations..."
                        value={shiftClosureRemarks}
                        onChange={(e) => setShiftClosureRemarks(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  id="btn-cancel-prompt-shift-close"
                  type="button"
                  onClick={() => setShowShiftClosePromptModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-prompt-shift-close"
                  type="button"
                  disabled={!signoffUNumber.trim() || !signoffName.trim()}
                  onClick={handleShiftCloseAction}
                  className={`px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    !signoffUNumber.trim() || !signoffName.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'btn-3d-emerald'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirm Shift Verify & Close</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
