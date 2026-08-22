'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Checklist, ChecklistItem, UserAccount } from '@/types/aviation';
import confetti from 'canvas-confetti';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Pin, 
  SkipForward, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Send,
  MessageSquare,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Lock
} from 'lucide-react';

interface ChecklistCarouselModalProps {
  isOpen: boolean;
  checklist: Checklist | null;
  groupName: string;
  subGroupName: string;
  currentUser: UserAccount | null;
  onClose: () => void;
  onSaveChecklist: (updatedChecklist: Checklist) => void;
  isShiftClosed?: boolean;
}

export function ChecklistCarouselModal({
  isOpen,
  checklist,
  groupName,
  subGroupName,
  currentUser,
  onClose,
  onSaveChecklist,
  isShiftClosed,
}: ChecklistCarouselModalProps) {
  if (!isOpen || !checklist) return null;

  return (
    <ChecklistCarouselContent
      key={checklist.id}
      checklist={checklist}
      groupName={groupName}
      subGroupName={subGroupName}
      currentUser={currentUser}
      onClose={onClose}
      onSaveChecklist={onSaveChecklist}
      isShiftClosed={isShiftClosed}
    />
  );
}

function ChecklistCarouselContent({
  checklist,
  groupName,
  subGroupName,
  currentUser,
  onClose,
  onSaveChecklist,
  isShiftClosed,
}: {
  checklist: Checklist;
  groupName: string;
  subGroupName: string;
  currentUser: UserAccount | null;
  onClose: () => void;
  onSaveChecklist: (updatedChecklist: Checklist) => void;
  isShiftClosed?: boolean;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(() => checklist.items.map((i) => ({ ...i })));
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const firstPendingIdx = checklist.items.findIndex((i) => i.status === 'not_done' || i.status === 'pinned');
    return firstPendingIdx >= 0 ? firstPendingIdx : 0;
  });
  const [skipAlert, setSkipAlert] = useState<string | null>(null);
  const [isSkipReasonModalOpen, setIsSkipReasonModalOpen] = useState<boolean>(false);
  const [skipReasonText, setSkipReasonText] = useState<string>('');
  
  // Free-text remarks modal upon completion
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState<boolean>(false);
  const [remarksText, setRemarksText] = useState<string>(() => checklist.remarks || '');
  const [remarksError, setRemarksError] = useState<string | null>(null);

  const currentItem = items[currentIndex];
  const totalItems = items.length;

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Require swipe delta of at least 50px horizontally, with X movement being greater than Y
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        goToPrev();
      } else {
        goToNext();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const goToNext = () => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSkipAlert(null);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSkipAlert(null);
    }
  };

  const handleMarkDone = () => {
    if (!currentItem) return;
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'done',
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    setSkipAlert(null);

    // Auto-advance if not on last item
    if (currentIndex < totalItems - 1) {
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 220);
    }
  };

  const handlePinItem = () => {
    if (!currentItem) return;
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'pinned',
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    setSkipAlert(null);

    // Advance to next card to break sequence
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleAttemptSkip = () => {
    if (!currentItem) return;
    if (currentItem.isMandatory) {
      setSkipAlert('MANDATORY SAFETY VIOLATION: This item is flagged as Mandatory and cannot be skipped under ground safety protocols. Complete item or consult your Duty Supervisor.');
      return;
    }

    // If optional, open skip reason modal
    setSkipReasonText('');
    setIsSkipReasonModalOpen(true);
  };

  const handleConfirmSkip = () => {
    if (!currentItem) return;
    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'skipped',
      skipReason: skipReasonText.trim() || 'Optional item skipped by operator',
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    setIsSkipReasonModalOpen(false);
    setSkipAlert(null);

    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (isRemarksModalOpen || isSkipReasonModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (!isShiftClosed) {
        if (e.key.toLowerCase() === 'd') {
          handleMarkDone();
        } else if (e.key.toLowerCase() === 'p') {
          handlePinItem();
        } else if (e.key.toLowerCase() === 's') {
          handleAttemptSkip();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Validation calculations for submit
  const pinnedCount = items.filter((i) => i.status === 'pinned').length;
  const unprocessedMandatoryCount = items.filter((i) => i.isMandatory && i.status !== 'done').length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const skippedCount = items.filter((i) => i.status === 'skipped').length;
  
  const canSubmit = pinnedCount === 0 && unprocessedMandatoryCount === 0;

  const handleOpenRemarksModal = () => {
    if (!canSubmit) return;
    setRemarksError(null);
    setIsRemarksModalOpen(true);
  };

  const handleFinalSubmit = () => {
    if (!remarksText.trim()) {
      setRemarksError('Free-text remarks are mandatory prior to finalizing checklist submission (e.g., Gate/Stand condition, GSE notes, clearance remarks).');
      return;
    }

    const updatedChecklist: Checklist = {
      ...checklist,
      items: items,
      status: 'completed',
      completedBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      completedAt: new Date().toISOString(),
      remarks: remarksText.trim(),
    };

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}

    onSaveChecklist(updatedChecklist);
    setIsRemarksModalOpen(false);
    onClose();
  };

  const handleSaveProgressDraft = () => {
    const isAnyDone = items.some((i) => i.status === 'done' || i.status === 'skipped');
    const updatedChecklist: Checklist = {
      ...checklist,
      items: items,
      status: isAnyDone ? 'in_progress' : 'pending',
    };
    onSaveChecklist(updatedChecklist);
    onClose();
  };

  const handleResetChecklist = () => {
    if (
      confirm(
        `Are you sure you want to reset all ${items.length} items in "${checklist.title}" back to NOT DONE and start over?`
      )
    ) {
      const resetItems = items.map((i) => ({
        ...i,
        status: 'not_done' as const,
        actionBy: undefined,
        actionAt: undefined,
        skipReason: undefined,
      }));
      setItems(resetItems);
      setCurrentIndex(0);
      setSkipAlert(null);
      setRemarksText('');

      const resetChecklistObj: Checklist = {
        ...checklist,
        items: resetItems,
        status: 'pending',
        completedBy: undefined,
        completedAt: undefined,
        remarks: undefined,
      };

      onSaveChecklist(resetChecklistObj);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        id="checklist-carousel-modal-container"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[95vh]"
      >
        {/* Header with Telemetry & Close */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {groupName}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ {subGroupName}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>{checklist.title}</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {checklist.version || 'v1.0'}
              </span>
              {checklist.versionDate && (
                <span className="text-[10px] text-slate-500 font-normal font-mono">
                  (Rev {checklist.versionDate})
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isShiftClosed && (
              <button
                id="btn-reset-carousel-checklist"
                type="button"
                onClick={handleResetChecklist}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs"
                title="Reset all items back to Not Done and start over"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="hidden sm:inline">Reset Checklist</span>
              </button>
            )}

            <button
              id="btn-close-carousel"
              onClick={isShiftClosed ? onClose : handleSaveProgressDraft}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title={isShiftClosed ? "Close modal" : "Save Progress and Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isShiftClosed && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 justify-center shrink-0">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Operational Shift is Closed & Archived. Reopen the shift as a supervisor to modify checks.</span>
          </div>
        )}

        {/* Progress Bar & Stepper Info */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span>
              STEP <strong className="text-slate-900 text-sm font-bold">{currentIndex + 1}</strong> OF {totalItems}
            </span>
            {pinnedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-300">
                <Pin className="w-3 h-3 text-amber-600" />
                {pinnedCount} PINNED
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              Done: <strong className="text-emerald-700 font-bold">{doneCount}</strong> | Skipped: <strong className="text-slate-700 font-semibold">{skippedCount}</strong>
            </span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${Math.round((doneCount / totalItems) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Carousel Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col justify-between space-y-6 bg-slate-50/50">
          {/* Skip Warning Alert Toast */}
          {skipAlert && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-3 animate-in shake shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-rose-900">Action Restricted by Safety Rule</div>
                <div className="text-rose-800 leading-relaxed">{skipAlert}</div>
              </div>
              <button 
                onClick={() => setSkipAlert(null)}
                className="ml-auto text-rose-600 hover:text-rose-800 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Single Focused Item Card */}
          {currentItem && (
            <div 
              id={`carousel-card-item-${currentIndex}`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="bg-white border-2 border-slate-200 rounded-2xl p-5 sm:p-8 flex flex-col justify-between shadow-sm relative min-h-[220px] select-none touch-pan-y"
            >
              {/* Card Meta Badges */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold flex items-center justify-center">
                    #{currentItem.sequenceOrder}
                  </span>
                  <span className="text-xs font-mono uppercase text-slate-500 font-semibold">Sequence Item</span>
                </div>

                <div className="flex items-center gap-2">
                  {currentItem.isMandatory ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      Mandatory
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold uppercase">
                      Optional Item
                    </span>
                  )}

                  {/* Status Indicator */}
                  {currentItem.status === 'done' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> DONE
                    </span>
                  )}
                  {currentItem.status === 'pinned' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                      <Pin className="w-3.5 h-3.5 text-amber-600" /> PINNED
                    </span>
                  )}
                  {currentItem.status === 'skipped' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                      SKIPPED
                    </span>
                  )}
                </div>
              </div>

              {/* Item Text */}
              <div className="py-6 sm:py-8">
                <p className="text-base sm:text-xl font-semibold text-slate-900 leading-relaxed">
                  {currentItem.text}
                </p>
                {currentItem.skipReason && (
                  <p className="mt-3 text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    Skip Note: {currentItem.skipReason}
                  </p>
                )}
              </div>

              {/* Card Bottom Nav Arrows */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                <button
                  id="btn-prev-card"
                  onClick={goToPrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition py-1 px-2 rounded-lg font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <span className="font-mono text-[11px] text-slate-400 text-center">
                  <span className="hidden sm:inline">Keyboard: [D] Done · [P] Pin · [S] Skip</span>
                  <span className="inline sm:hidden">Swipe left/right to navigate</span>
                </span>

                <button
                  id="btn-next-card"
                  onClick={goToNext}
                  disabled={currentIndex === totalItems - 1}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition py-1 px-2 rounded-lg font-semibold"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Action Control Deck */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* DONE Button */}
            <button
              id="btn-action-done"
              type="button"
              disabled={isShiftClosed}
              onClick={handleMarkDone}
              className={`py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                currentItem?.status === 'done'
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Check className="w-5 h-5" />
              <span>DONE (Mark Checked)</span>
            </button>

            {/* PIN Button */}
            <button
              id="btn-action-pin"
              type="button"
              disabled={isShiftClosed}
              onClick={handlePinItem}
              className={`py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                currentItem?.status === 'pinned'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800'
              }`}
              title="Defer processing to complete later"
            >
              <Pin className="w-4 h-4 text-amber-700" />
              <span>PIN (Defer Card)</span>
            </button>

            {/* SKIP Button */}
            <button
              id="btn-action-skip"
              type="button"
              disabled={isShiftClosed}
              onClick={handleAttemptSkip}
              className={`py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border disabled:opacity-50 disabled:cursor-not-allowed ${
                currentItem?.isMandatory
                  ? 'bg-slate-100 border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title={currentItem?.isMandatory ? 'Mandatory items cannot be skipped' : 'Skip optional item'}
            >
              <SkipForward className="w-4 h-4" />
              <span>SKIP {currentItem?.isMandatory ? '(Restricted)' : '(Optional)'}</span>
            </button>
          </div>

          {/* Quick Jump Thumbnail Rail */}
          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Card Overview Navigator:</span>
              <span className="font-normal text-slate-400">Click to jump</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {items.map((item, idx) => {
                const isActive = idx === currentIndex;
                let bgClass = 'bg-white border-slate-200 text-slate-700';
                if (item.status === 'done') bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                else if (item.status === 'pinned') bgClass = 'bg-amber-50 border-amber-300 text-amber-900';
                else if (item.status === 'skipped') bgClass = 'bg-slate-100 border-slate-200 text-slate-400';

                return (
                  <button
                    key={`${item.id}-${idx}`}
                    id={`btn-jump-card-${idx}`}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setSkipAlert(null);
                    }}
                    className={`min-w-[40px] h-9 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-1 px-1.5 transition shrink-0 ${bgClass} ${
                      isActive ? 'ring-2 ring-blue-600 scale-105 shadow-xs' : 'hover:border-slate-400'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {item.status === 'done' && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                    {item.status === 'pinned' && <Pin className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with Final Submit Action */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            {!canSubmit ? (
              <span className="text-amber-800 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Cannot submit:{' '}
                  {unprocessedMandatoryCount > 0 && `${unprocessedMandatoryCount} mandatory pending `}
                  {pinnedCount > 0 && `${pinnedCount} pinned unresolved`}
                </span>
              </span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All mandatory checks satisfied. Ready for sign-off.</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isShiftClosed ? (
              <button
                id="btn-close-readonly"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                Close (Read Only Mode)
              </button>
            ) : (
              <>
                <button
                  id="btn-save-draft"
                  type="button"
                  onClick={handleSaveProgressDraft}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Save Draft & Exit
                </button>

                <button
                  id="btn-complete-submit-checklist"
                  type="button"
                  onClick={handleOpenRemarksModal}
                  disabled={!canSubmit}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition ${
                    canSubmit
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Checklist</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Optional Skip Reason Sub-Modal */}
      {isSkipReasonModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <HelpCircle className="w-5 h-5 text-sky-600" />
              <h3>Optional Item Skip Note</h3>
            </div>
            <p className="text-xs text-slate-600">
              Please specify the operational rationale for skipping this optional check (e.g. equipment not fitted, stand bypass):
            </p>
            <input
              type="text"
              placeholder="e.g. Not applicable to this flight configuration"
              value={skipReasonText}
              onChange={(e) => setSkipReasonText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSkipReasonModalOpen(false)}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-skip"
                type="button"
                onClick={handleConfirmSkip}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free-Text Remarks Mandatory Modal on Final Submit */}
      {isRemarksModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div 
            id="mandatory-remarks-modal-container"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xl text-slate-900"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Final Checklist Remarks (Mandatory)</h3>
                <p className="text-xs text-slate-500">Record operational shift notes before official sign-off</p>
              </div>
            </div>

            {remarksError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{remarksError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Ground Execution Notes & Aircraft Handover Remarks
              </label>
              <textarea
                id="input-checklist-remarks"
                rows={4}
                placeholder="e.g. Stand B14. Chocks positioned, GPU connected, fuel hydrometer verified at 0.804 SG. Captain acknowledged and signed final electronic loadsheet with zero discrepancies."
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white placeholder:text-slate-400 leading-relaxed font-sans"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                Logged under your U-Number credential: <strong className="text-slate-800 font-bold">{currentUser?.uNumber || 'Operator'}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRemarksModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Back to Cards
              </button>

              <button
                id="btn-confirm-final-submit"
                type="button"
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Authorize & Sign Checklist</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
