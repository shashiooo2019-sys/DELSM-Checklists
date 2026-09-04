'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Checklist, ChecklistItem, ChecklistStatus, UserAccount } from '@/types/aviation';
import { ConfirmModal, ConfirmModalState } from './ConfirmModal';
import confetti from 'canvas-confetti';
import { soundEffects } from '@/lib/soundEffects';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
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
  Lock,
  Maximize2,
  Minimize2,
  Layers,
  CheckCircle2,
  Volume2,
  VolumeX,
  Loader2,
  Cloud,
  CloudOff
} from 'lucide-react';

interface ChecklistCarouselModalProps {
  isOpen: boolean;
  checklist: Checklist | null;
  groupName: string;
  subGroupName: string;
  currentUser: UserAccount | null;
  onClose: () => void;
  onSaveChecklist: (updatedChecklist: Checklist) => Promise<{ success: boolean; error?: string }> | void;
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
  onSaveChecklist: (updatedChecklist: Checklist) => Promise<{ success: boolean; error?: string }> | void;
  isShiftClosed?: boolean;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(() => checklist.items.map((i) => ({ ...i })));
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const firstPendingIdx = checklist.items.findIndex((i) => i.status === 'not_done' || i.status === 'pinned');
    return firstPendingIdx >= 0 ? firstPendingIdx : 0;
  });
  const [skipAlert, setSkipAlert] = useState<string | null>(null);
  const [isSkipReasonModalOpen, setIsSkipReasonModalOpen] = useState<boolean>(false);
  const [skipReasonText, setSkipReasonText] = useState<string>('');
  const [isSkippingMandatory, setIsSkippingMandatory] = useState<boolean>(false);
  const [skipReasonError, setSkipReasonError] = useState<string | null>(null);
  
  // Non-compliance (Missed / Incorrectly Executed) remark sub-modal
  const [isNonComplianceModalOpen, setIsNonComplianceModalOpen] = useState<boolean>(false);
  const [nonComplianceType, setNonComplianceType] = useState<'missed' | 'incorrectly_executed'>('missed');
  const [nonComplianceRemarkText, setNonComplianceRemarkText] = useState<string>('');
  const [nonComplianceError, setNonComplianceError] = useState<string | null>(null);

  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState<boolean>(false);
  
  // Free-text remarks modal upon completion
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState<boolean>(false);
  const [remarksText, setRemarksText] = useState<string>(() => checklist.remarks || '');
  const [remarksError, setRemarksError] = useState<string | null>(null);

  // Firestore Cloud Sync Verification State before yay and celebration
  const [isSubmittingToCloud, setIsSubmittingToCloud] = useState<boolean>(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [isCloudSyncSuccess, setIsCloudSyncSuccess] = useState<boolean>(false);

  // Full Screen Mode State (Default to Full Screen for focused execution)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);

  const currentItem = items[currentIndex];
  const totalItems = items.length;

  // Touch & Mouse Swipe Gesture State
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [dragOffsetY, setDragOffsetY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showSwipeDoneToast, setShowSwipeDoneToast] = useState<boolean>(false);

  // Audio Mute State
  const [isMuted, setIsMuted] = useState<boolean>(soundEffects.isMuted());

  const toggleSoundMute = () => {
    const nextState = soundEffects.toggleMute();
    setIsMuted(nextState);
    triggerHaptic([15]);
    setNavigationToastText(nextState ? 'Audio Jingle Muted 🔇' : 'Audio Jingle Enabled 🔔');
    setTimeout(() => setNavigationToastText(null), 2000);
  };

  // End of Checklist Rubberband & Navigation State
  const [isRubberbanding, setIsRubberbanding] = useState<boolean>(false);
  const [showEndOfChecklistPrompt, setShowEndOfChecklistPrompt] = useState<boolean>(false);
  const [navigationToastText, setNavigationToastText] = useState<string | null>(null);

  const triggerHaptic = (pattern: number[] = [20]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const navigateToFirstSkippedOrPinned = () => {
    // Find first skipped or pinned item in the checklist
    let targetIdx = items.findIndex((i) => i.status === 'skipped' || i.status === 'pinned');
    if (targetIdx === -1) {
      targetIdx = items.findIndex((i) => i.status === 'not_done');
    }

    if (targetIdx >= 0) {
      setCurrentIndex(targetIdx);
      setShowEndOfChecklistPrompt(false);
      setSkipAlert(null);
      triggerHaptic([40, 60, 40]);
      const targetItem = items[targetIdx];
      const statusLabel = targetItem.status === 'skipped' ? 'SKIPPED' : targetItem.status === 'pinned' ? 'PINNED' : 'PENDING';
      setNavigationToastText(`Navigated to ${statusLabel} Item #${targetItem.sequenceOrder}`);
      setTimeout(() => setNavigationToastText(null), 3000);
    } else {
      setShowEndOfChecklistPrompt(false);
    }
  };

  const navigateToSubmitChecklist = () => {
    setIsRubberbanding(true);
    setTimeout(() => setIsRubberbanding(false), 700);
    setShowEndOfChecklistPrompt(false);
    triggerHaptic([30, 40, 50]);
    setNavigationToastText('All items processed! Navigating to Submit Checklist...');
    setTimeout(() => setNavigationToastText(null), 2500);
    setTimeout(() => {
      setIsFullScreen(false);
      setRemarksError(null);
      setIsRemarksModalOpen(true);
    }, 280);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
    setDragOffsetX(0);
    setDragOffsetY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;
    const isAtEnd = currentIndex === totalItems - 1;

    if (isFullScreen) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (isAtEnd && diffX < 0) {
          // Elastic rubberband resistance at checklist boundary
          setDragOffsetX(Math.max(-80, diffX * 0.35));
        } else {
          setDragOffsetX(diffX);
        }
        setDragOffsetY(0);
      } else {
        setDragOffsetX(0);
        setDragOffsetY(diffY);
      }
    } else {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          if (isAtEnd) {
            // Elastic rubberband resistance at checklist boundary
            setDragOffsetX(Math.max(-75, diffX * 0.35));
          } else {
            // Dragging left (Mark Done)
            setDragOffsetX(Math.max(-120, diffX));
          }
        } else {
          // Dragging right (Previous)
          setDragOffsetX(Math.min(120, diffX));
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchStartY.current === null) {
      setIsDragging(false);
      setDragOffsetX(0);
      setDragOffsetY(0);
      return;
    }

    const threshold = 40; // px threshold for gesture trigger
    const isAtEnd = currentIndex === totalItems - 1;

    if (isFullScreen) {
      const absX = Math.abs(dragOffsetX);
      const absY = Math.abs(dragOffsetY);

      // Gesture 1: Swipe Left
      if (dragOffsetX <= -threshold && absX >= absY) {
        if (isAtEnd) {
          let updatedList = items;
          if (!isShiftClosed && currentItem && currentItem.status !== 'done') {
            soundEffects.playDoneJingle();
            updatedList = [...items];
            updatedList[currentIndex] = {
              ...currentItem,
              status: 'done',
              actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
              actionAt: new Date().toISOString(),
            };
            setItems(updatedList);
          }

          const hasSkippedOrPinned = updatedList.some((i) => i.status === 'skipped' || i.status === 'pinned');
          const hasUnprocessed = updatedList.some((i) => i.status === 'not_done');

          // Trigger rubberband bounce effect
          setIsRubberbanding(true);
          setTimeout(() => setIsRubberbanding(false), 700);

          if (hasSkippedOrPinned || hasUnprocessed) {
            if (showEndOfChecklistPrompt) {
              // Swiping left again while prompt is visible moves directly to first skipped/pinned item
              navigateToFirstSkippedOrPinned();
            } else {
              triggerHaptic([40, 30, 40]);
              setShowEndOfChecklistPrompt(true);
            }
          } else {
            // No skipped items remain -> navigate to submit checklist with left swipe gesture
            navigateToSubmitChecklist();
          }
        } else {
          if (!isShiftClosed) {
            triggerHaptic([35]);
            handleMarkDone();
            setShowSwipeDoneToast(true);
            setTimeout(() => setShowSwipeDoneToast(false), 900);
          }
        }
      }
      // Gesture 2: Swipe Right -> EXIT FULL SCREEN
      else if (dragOffsetX >= threshold && absX >= absY) {
        triggerHaptic([15]);
        setShowEndOfChecklistPrompt(false);
        setIsFullScreen(false);
      }
      // Gesture 3 & 4: Swipe Up or Down -> EXIT FULL SCREEN
      else if (absY >= threshold && absY > absX) {
        triggerHaptic([15]);
        setShowEndOfChecklistPrompt(false);
        setIsFullScreen(false);
      }
    } else {
      // Standard Mode: Swipe Left
      if (dragOffsetX <= -35) {
        if (isAtEnd) {
          let updatedList = items;
          if (!isShiftClosed && currentItem && currentItem.status !== 'done') {
            soundEffects.playDoneJingle();
            updatedList = [...items];
            updatedList[currentIndex] = {
              ...currentItem,
              status: 'done',
              actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
              actionAt: new Date().toISOString(),
            };
            setItems(updatedList);
          }

          const hasSkippedOrPinned = updatedList.some((i) => i.status === 'skipped' || i.status === 'pinned');
          const hasUnprocessed = updatedList.some((i) => i.status === 'not_done');

          // Trigger rubberband bounce effect
          setIsRubberbanding(true);
          setTimeout(() => setIsRubberbanding(false), 700);

          if (hasSkippedOrPinned || hasUnprocessed) {
            if (showEndOfChecklistPrompt) {
              // Swiping left again while prompt is active jumps to first skipped/pinned item
              navigateToFirstSkippedOrPinned();
            } else {
              triggerHaptic([40, 30, 40]);
              setShowEndOfChecklistPrompt(true);
            }
          } else {
            // No skipped items remain -> navigate to submit checklist with left swipe gesture
            navigateToSubmitChecklist();
          }
        } else {
          if (!isShiftClosed) {
            triggerHaptic([25]);
            handleMarkDone();
            setShowSwipeDoneToast(true);
            setTimeout(() => setShowSwipeDoneToast(false), 900);
          }
        }
      } 
      // Standard Mode: Swipe Right -> Previous Item
      else if (dragOffsetX >= 45) {
        triggerHaptic([15]);
        setShowEndOfChecklistPrompt(false);
        goToPrev();
      }
    }

    setDragOffsetX(0);
    setDragOffsetY(0);
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Mouse Drag support for desktop browser testing
  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    setIsDragging(true);
    setDragOffsetX(0);
    setDragOffsetY(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.clientX - touchStartX.current;
    const diffY = e.clientY - touchStartY.current;
    const isAtEnd = currentIndex === totalItems - 1;

    if (isFullScreen) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (isAtEnd && diffX < 0) {
          setDragOffsetX(Math.max(-80, diffX * 0.35));
        } else {
          setDragOffsetX(diffX);
        }
        setDragOffsetY(0);
      } else {
        setDragOffsetX(0);
        setDragOffsetY(diffY);
      }
    } else {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          if (isAtEnd) {
            setDragOffsetX(Math.max(-75, diffX * 0.35));
          } else {
            setDragOffsetX(Math.max(-120, diffX));
          }
        } else {
          setDragOffsetX(Math.min(120, diffX));
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      handleTouchEnd();
    }
  };

  const goToNext = () => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSkipAlert(null);
      setShowEndOfChecklistPrompt(false);
    } else {
      // Reached end of checklist on last item
      const hasSkippedOrPinned = items.some((i) => i.status === 'skipped' || i.status === 'pinned');
      const hasUnprocessed = items.some((i) => i.status === 'not_done');

      setIsRubberbanding(true);
      setTimeout(() => setIsRubberbanding(false), 700);

      if (hasSkippedOrPinned || hasUnprocessed) {
        setShowEndOfChecklistPrompt(true);
      } else {
        // No skipped items remain -> navigate to submit checklist
        navigateToSubmitChecklist();
      }
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSkipAlert(null);
      setShowEndOfChecklistPrompt(false);
    }
  };

  // Helper to persist checklist progress immediately on every item change
  const persistChecklistProgress = (updatedItems: ChecklistItem[], forceCompleted?: boolean) => {
    const isAllProcessed = updatedItems.length > 0 && updatedItems.every((i) => i.status !== 'not_done' && i.status !== 'pinned');
    const isAnyActive = updatedItems.some((i) => i.status !== 'not_done');
    const computedStatus: ChecklistStatus = forceCompleted
      ? 'completed'
      : checklist.status === 'completed'
      ? 'completed'
      : isAllProcessed
      ? 'in_progress'
      : isAnyActive
      ? 'in_progress'
      : 'pending';

    const updatedChecklist: Checklist = {
      ...checklist,
      items: updatedItems,
      status: computedStatus,
      remarks: remarksText.trim() || checklist.remarks,
    };
    onSaveChecklist(updatedChecklist);
  };

  const handleMarkDone = () => {
    if (!currentItem) return;
    
    // Play celebratory affirmative aviation jingle sound
    soundEffects.playDoneJingle();

    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'done',
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    setSkipAlert(null);
    persistChecklistProgress(updated);

    // Auto-advance if not on last item
    if (currentIndex < totalItems - 1) {
      setShowEndOfChecklistPrompt(false);
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 220);
    } else {
      // Reached end of checklist on last item
      const hasSkippedOrPinned = updated.some((i) => i.status === 'skipped' || i.status === 'pinned');
      const hasUnprocessed = updated.some((i) => i.status === 'not_done');

      setIsRubberbanding(true);
      setTimeout(() => setIsRubberbanding(false), 700);

      if (hasSkippedOrPinned || hasUnprocessed) {
        setShowEndOfChecklistPrompt(true);
      } else {
        // No skipped items remain -> navigate to submit checklist
        navigateToSubmitChecklist();
      }
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
    persistChecklistProgress(updated);

    // Advance to next card to break sequence
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleAttemptSkip = () => {
    if (!currentItem) return;
    setIsSkippingMandatory(!!currentItem.isMandatory);
    setSkipReasonText('');
    setSkipReasonError(null);
    setSkipAlert(null);
    setIsSkipReasonModalOpen(true);
  };

  const handleConfirmSkip = () => {
    if (!currentItem) return;
    if (isSkippingMandatory && !skipReasonText.trim()) {
      setSkipReasonError('Operational justification / reason is mandatory to authorize skipping this safety check.');
      return;
    }

    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: 'skipped',
      skipReason: skipReasonText.trim() || (isSkippingMandatory ? 'Mandatory safety check bypassed by operator' : 'Optional check skipped by operator'),
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    persistChecklistProgress(updated);
    setIsSkipReasonModalOpen(false);
    setSkipAlert(null);

    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleOpenNonComplianceModal = (type: 'missed' | 'incorrectly_executed') => {
    if (!currentItem) return;
    setNonComplianceType(type);
    setNonComplianceRemarkText(currentItem.remark || '');
    setNonComplianceError(null);
    setIsNonComplianceModalOpen(true);
  };

  const handleConfirmNonCompliance = () => {
    if (!currentItem) return;
    if (!nonComplianceRemarkText.trim()) {
      setNonComplianceError(`A remark is required when marking an item as ${nonComplianceType === 'missed' ? 'Missed' : 'Incorrectly Executed'}. Please enter details.`);
      return;
    }

    const updated = [...items];
    updated[currentIndex] = {
      ...currentItem,
      status: nonComplianceType,
      remark: nonComplianceRemarkText.trim(),
      actionBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Airside Operator',
      actionAt: new Date().toISOString(),
    };
    setItems(updated);
    persistChecklistProgress(updated);
    setIsNonComplianceModalOpen(false);
    setNonComplianceRemarkText('');
    setNonComplianceError(null);
    setSkipAlert(null);

    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (isRemarksModalOpen || isSkipReasonModalOpen || isNonComplianceModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If end-of-checklist prompt is visible, handle Y / N / Enter / Escape / ArrowLeft
      if (showEndOfChecklistPrompt) {
        if (e.key.toLowerCase() === 'y' || e.key === 'Enter' || e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateToFirstSkippedOrPinned();
          return;
        }
        if (e.key.toLowerCase() === 'n' || e.key === 'Escape') {
          e.preventDefault();
          setShowEndOfChecklistPrompt(false);
          return;
        }
      }

      // Toggle sound mute with 'u' key or Shift+'m'
      if (e.key.toLowerCase() === 'u' || (e.shiftKey && e.key.toLowerCase() === 'm')) {
        toggleSoundMute();
        return;
      }

      if (isFullScreen) {
        if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          setIsFullScreen(false);
        } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'd') {
          if (!isShiftClosed) {
            handleMarkDone();
            setShowSwipeDoneToast(true);
            setTimeout(() => setShowSwipeDoneToast(false), 900);
          }
        } else if (e.key.toLowerCase() === 'f') {
          setIsFullScreen(false);
        }
        return;
      }

      if (e.key.toLowerCase() === 'f') {
        setIsFullScreen(true);
        return;
      }

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
        } else if (e.key.toLowerCase() === 'm') {
          handleOpenNonComplianceModal('missed');
        } else if (e.key.toLowerCase() === 'i') {
          handleOpenNonComplianceModal('incorrectly_executed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Validation calculations for submit
  const pinnedCount = items.filter((i) => i.status === 'pinned').length;
  const notDoneCount = items.filter((i) => i.status === 'not_done').length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const skippedCount = items.filter((i) => i.status === 'skipped').length;
  const missedCount = items.filter((i) => i.status === 'missed').length;
  const incorrectlyCount = items.filter((i) => i.status === 'incorrectly_executed').length;
  
  const mandatorySkippedItems = items.filter((i) => i.status === 'skipped' && i.isMandatory);
  const mandatorySkippedCount = mandatorySkippedItems.length;
  const optionalSkippedItems = items.filter((i) => i.status === 'skipped' && !i.isMandatory);
  const optionalSkippedCount = optionalSkippedItems.length;
  const nonCompliantItems = items.filter((i) => i.status === 'missed' || i.status === 'incorrectly_executed');

  // Donut chart arc calculations
  const donutSize = 34;
  const donutStrokeWidth = 3;
  const donutRadius = (donutSize - donutStrokeWidth) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const strokeDone = totalItems > 0 ? (doneCount / totalItems) * donutCircumference : 0;
  const strokeExceptions = totalItems > 0 ? ((skippedCount + pinnedCount) / totalItems) * donutCircumference : 0;
  const strokeIssues = totalItems > 0 ? ((missedCount + incorrectlyCount) / totalItems) * donutCircumference : 0;
  const percentComplete = totalItems > 0 ? Math.round(((doneCount + skippedCount + missedCount + incorrectlyCount) / totalItems) * 100) : 0;

  // A checklist can be submitted when all items are processed (none are pinned or not_done)
  const canSubmit = pinnedCount === 0 && notDoneCount === 0;

  const handleOpenRemarksModal = () => {
    if (!canSubmit) return;
    setRemarksError(null);
    setIsRemarksModalOpen(true);
  };

  const handleFinalSubmit = async () => {
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

    setIsSubmittingToCloud(true);
    setCloudSyncError(null);
    setRemarksError(null);

    try {
      // 1. Confirm that all data is saved to Firestore and in sync with Cloud before celebrating
      const res = await onSaveChecklist(updatedChecklist);
      if (res && res.success === false) {
        setIsSubmittingToCloud(false);
        setCloudSyncError(res.error || 'Checklist data could not be saved to Firestore database. Data is not yet in sync with the cloud.');
        return;
      }

      // 2. Data is confirmed saved and in sync with Firestore Cloud!
      setIsSubmittingToCloud(false);
      setIsCloudSyncSuccess(true);

      // 3. Play celebratory "Yay!" victory fanfare jingle
      soundEffects.playYayJingle();

      // 4. Trigger celebration confetti / party poppers display
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        // Second staggered burst for realistic party poppers effect
        setTimeout(() => {
          try {
            confetti({
              particleCount: 65,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
            });
            confetti({
              particleCount: 65,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
            });
          } catch {}
        }, 250);
      } catch {}

      // 5. Allow operator to view confirmation and celebration before modal dismiss
      setTimeout(() => {
        setIsRemarksModalOpen(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setIsSubmittingToCloud(false);
      setCloudSyncError(err instanceof Error ? err.message : 'Error communicating with Firestore cloud server.');
    }
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
    setConfirmModal({
      isOpen: true,
      title: 'Reset Checklist',
      message: `Are you sure you want to reset all ${items.length} items in "${checklist.title}" back to NOT DONE and start over?`,
      confirmLabel: 'Reset Checklist',
      variant: 'warning',
      onConfirm: () => {
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
      },
    });
  };

  // Adaptive font size helper based on text length to prevent overflow and maximize visibility
  const getAdaptiveFontClass = (text: string, isFull: boolean = false) => {
    const len = text.length;
    if (isFull) {
      if (len < 40) return 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl';
      if (len < 100) return 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl';
      if (len < 200) return 'text-xl sm:text-3xl md:text-4xl lg:text-5xl';
      return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl';
    }
    // Standard carousel view
    if (len < 40) return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl';
    if (len < 100) return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl';
    if (len < 200) return 'text-lg sm:text-xl md:text-2xl lg:text-3xl';
    return 'text-base sm:text-lg md:text-xl lg:text-2xl';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0.5 sm:p-1.5 md:p-2 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-hidden">
      {/* FULL SCREEN VIEW MODE (All buttons hidden, gestures: Left=Done, Right/Up/Down=Exit) */}
      {isFullScreen ? (
        <div
          id="checklist-fullscreen-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="fixed inset-0 z-[100] w-screen h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-3 sm:p-5 md:p-8 select-none overflow-hidden cursor-grab active:cursor-grabbing"
        >
          {/* Top Telemetry & Status Bar (All Action Buttons Hidden) */}
          <div className="flex items-center justify-between gap-2 shrink-0 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold tracking-wider uppercase shadow-sm shrink-0">
                {groupName}
              </span>
              <span className="text-xs text-slate-400 font-medium shrink-0">/ {subGroupName}</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                {checklist.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-200 border border-slate-700 text-xs font-mono font-bold">
                ITEM {currentIndex + 1} OF {totalItems}
              </span>

              {/* Mute / Unmute Button in Full Screen Mode */}
              <button
                id="btn-toggle-sound-fullscreen"
                type="button"
                onClick={toggleSoundMute}
                className={`p-1.5 px-2 sm:px-2.5 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isMuted 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700' 
                    : 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/60 shadow-emerald-950/50'
                }`}
                title={isMuted ? "Unmute audio jingle (Shortcut: U)" : "Mute audio jingle (Shortcut: U)"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-400" />
                    <span className="hidden sm:inline">Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Sound On</span>
                  </>
                )}
              </button>

              {/* Exit Full Screen Button */}
              <button
                id="btn-exit-fullscreen"
                type="button"
                onClick={() => setIsFullScreen(false)}
                className="p-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-700"
                title="Exit Full Screen (or Swipe Right / Up / Down, [F] or [Esc])"
              >
                <Minimize2 className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">Exit Full</span>
              </button>
            </div>
          </div>

          {/* Center Main Stage: Huge Checklist Item Description taking up most part of screen */}
          <div 
            style={{
              transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : 'translateX(0)',
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className={`flex-1 flex flex-col justify-center items-center py-2 sm:py-4 px-2 sm:px-4 max-w-5xl mx-auto w-full text-center space-y-3 sm:space-y-4 min-h-0 relative ${
              isRubberbanding ? 'animate-rubberband-bounce' : ''
            }`}
          >
            {/* End of Checklist Prompt Overlay in Full Screen */}
            {showEndOfChecklistPrompt && (
              <div className="absolute inset-x-2 sm:inset-x-6 top-1/2 -translate-y-1/2 max-w-xl mx-auto bg-slate-900/95 border-2 border-amber-400/90 rounded-2xl p-5 sm:p-6 text-white shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 z-40 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mx-auto text-amber-300 shadow-md">
                  <SkipForward className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                    Checklist Boundary Reached
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    You have reached the end of the checklist.
                  </h3>
                  <p className="text-sm text-slate-300 font-medium">
                    Do you want to navigate to skipped items?
                  </p>
                </div>

                {/* Badges of skipped / pinned items */}
                <div className="flex items-center justify-center gap-2 text-xs font-mono flex-wrap">
                  {skippedCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                      {skippedCount} Skipped Item{skippedCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {pinnedCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-600/60 text-amber-300 font-bold">
                      {pinnedCount} Pinned Item{pinnedCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {notDoneCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-600/60 text-blue-300 font-bold">
                      {notDoneCount} Incomplete Item{notDoneCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
                  <button
                    id="btn-confirm-navigate-skipped-fullscreen"
                    type="button"
                    onClick={navigateToFirstSkippedOrPinned}
                    className="btn-3d-amber px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Yes, Navigate to Skipped Items</span>
                  </button>
                  
                  <button
                    id="btn-dismiss-navigate-skipped-fullscreen"
                    type="button"
                    onClick={() => setShowEndOfChecklistPrompt(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-bold transition cursor-pointer active:scale-95"
                  >
                    Dismiss
                  </button>
                </div>
                
                <p className="text-[11px] font-mono text-amber-300/80">
                  👉 Swipe left again or press [Y] / [Enter] to navigate immediately
                </p>
              </div>
            )}

            {/* Sequence & Mandatory Status Tag */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap animate-in fade-in shrink-0">
              <span className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-600/30 border-2 border-blue-400 text-blue-300 font-mono text-base sm:text-xl font-black flex items-center justify-center shadow-md">
                #{currentItem.sequenceOrder}
              </span>

              {currentItem.isMandatory ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm">
                  <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                  Mandatory Safety Item
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs sm:text-sm font-bold uppercase">
                  Optional Item
                </span>
              )}

              {currentItem.status === 'done' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs sm:text-sm font-black uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" /> DONE
                </span>
              )}
              {currentItem.status === 'pinned' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-black uppercase tracking-wider">
                  <Pin className="w-3.5 h-3.5 text-amber-400" /> PINNED
                </span>
              )}
              {currentItem.status === 'skipped' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs sm:text-sm font-bold uppercase">
                  SKIPPED
                </span>
              )}
              {currentItem.status === 'missed' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-900/50 text-rose-300 border border-rose-700 text-xs sm:text-sm font-black uppercase tracking-wider">
                  <X className="w-3.5 h-3.5 text-rose-400 stroke-[3]" /> MISSED ❌
                </span>
              )}
              {currentItem.status === 'incorrectly_executed' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700 text-xs sm:text-sm font-black uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> INCORRECTLY EXECUTED ❌
                </span>
              )}
            </div>

            {/* Huge Item Description taking up most part of screen */}
            <div className="w-full flex-1 flex flex-col justify-center overflow-y-auto px-2 py-2 scrollbar-thin min-h-0">
              <p className={`${getAdaptiveFontClass(currentItem.text, true)} font-extrabold text-white leading-tight sm:leading-snug tracking-tight drop-shadow-md break-words select-text`}>
                {currentItem.text}
              </p>

              {currentItem.skipReason && (
                <p className="mt-3 text-xs sm:text-sm text-amber-300 bg-amber-950/50 border border-amber-800/60 p-2.5 rounded-xl inline-block max-w-2xl mx-auto shadow-sm">
                  Skip Note: {currentItem.skipReason}
                </p>
              )}
              {currentItem.remark && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs sm:text-sm text-rose-300 inline-block max-w-2xl mx-auto text-left shadow-sm">
                  <span className="font-bold flex items-center gap-1 text-rose-400 mb-0.5">
                    <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                    Operator Remark:
                  </span>
                  <p className="font-mono text-rose-200">{currentItem.remark}</p>
                </div>
              )}
            </div>

            {/* Gesture feedback indicators on drag */}
            {dragOffsetX < -30 && (
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-black tracking-wider uppercase animate-pulse shadow-lg flex items-center gap-1.5 shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Release to Mark DONE</span>
              </div>
            )}
            {(dragOffsetX > 30 || Math.abs(dragOffsetY) > 30) && (
              <div className="p-2.5 bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase animate-pulse shadow-lg flex items-center gap-1.5 shrink-0">
                <Minimize2 className="w-4 h-4" />
                <span>Release to Exit Full Screen</span>
              </div>
            )}
          </div>

          {/* Swipe Done Success Toast overlay in Full Screen */}
          {showSwipeDoneToast && (
            <div className="absolute inset-0 bg-emerald-600/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 animate-in zoom-in-95 duration-150 z-30">
              <div className="w-14 h-14 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-2xl mb-2">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-wide">ITEM MARKED DONE</span>
              <span className="text-xs text-emerald-100 font-mono mt-0.5">Advancing to next checklist task...</span>
            </div>
          )}

          {/* Bottom Gesture Navigation Guide (All Buttons Hidden) */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-mono flex-wrap gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
                currentIndex === totalItems - 1 && (pinnedCount === 0 && notDoneCount === 0 && skippedCount === 0)
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500/60 shadow-sm animate-pulse'
                  : currentIndex === totalItems - 1
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 shadow-sm'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {currentIndex === totalItems - 1 ? (
                  (pinnedCount === 0 && notDoneCount === 0 && skippedCount === 0) 
                    ? '👈 Swipe Left: Submit Checklist 🏁' 
                    : '👈 Swipe Left: Rubberband & Skipped Items'
                ) : (
                  '👈 Swipe Left: Mark Done'
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700 font-medium">
                👉 Swipe Right · 👆 Up · 👇 Down: Exit Full Screen
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD CAROUSEL VIEW MODE (Expanded screen, adaptive font, minimized margins) */
        <div 
          id="checklist-carousel-modal-container"
          className="w-full max-w-6xl bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 h-[98vh] max-h-[98vh]"
        >
          {/* Streamlined Ultra-Compact Top Header */}
          <div className="px-3 py-1.5 sm:px-5 sm:py-2 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {groupName}
              </span>
              <span className="text-xs text-slate-400 font-medium shrink-0">/ {subGroupName}</span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate flex items-center gap-1">
                <span>{checklist.title}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {checklist.version || 'v1.0'}
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Prominent Full Screen Mode Toggle Button */}
              <button
                id="btn-toggle-fullscreen"
                type="button"
                onClick={() => setIsFullScreen(true)}
                className="px-2.5 sm:px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all text-xs font-black flex items-center gap-1.5 shadow-sm hover:shadow-md border border-blue-400/40 cursor-pointer group"
                title="Expand to Full Screen Mode (All buttons hidden, gestures enabled, [F] shortcut)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-sky-200" />
                <span className="text-xs tracking-tight font-extrabold">Full Screen</span>
                <span className="hidden sm:inline text-[10px] font-mono px-1 py-0.2 rounded bg-blue-900/60 border border-blue-400/30 text-sky-200">
                  F
                </span>
              </button>

              {/* Mute / Unmute Button */}
              <button
                id="btn-toggle-sound"
                type="button"
                onClick={toggleSoundMute}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition text-xs font-bold flex items-center gap-1.5 shadow-2xs border cursor-pointer active:scale-95 ${
                  isMuted 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300' 
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                }`}
                title={isMuted ? "Unmute audio jingle (Shortcut: U)" : "Mute audio jingle (Shortcut: U)"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden md:inline text-[11px]">Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden md:inline text-[11px]">Sound On</span>
                  </>
                )}
              </button>

              {!isShiftClosed && (
                <button
                  id="btn-reset-carousel-checklist"
                  type="button"
                  onClick={handleResetChecklist}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                  title="Reset all items back to Not Done and start over"
                >
                  <RotateCcw className="w-3 h-3 text-rose-600 shrink-0" />
                  <span className="hidden md:inline text-[11px]">Reset</span>
                </button>
              )}

              <button
                id="btn-view-all-checklist"
                type="button"
                onClick={() => setIsViewAllModalOpen(true)}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                title="View all checklist points in read-only mode"
              >
                <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="hidden md:inline text-[11px]">View All</span>
              </button>

              <button
                id="btn-close-carousel"
                onClick={isShiftClosed ? onClose : handleSaveProgressDraft}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title={isShiftClosed ? "Close modal" : "Save Progress and Close"}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {isShiftClosed && (
            <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 justify-center shrink-0">
              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Operational Shift is Closed & Archived. Reopen shift to modify.</span>
            </div>
          )}

          {/* Streamlined Step Details & Donut Progress Arc */}
          <div className="px-3 sm:px-5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0 gap-2">
            <div className="flex items-center gap-2 font-mono">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black border border-blue-200">
                STEP {currentIndex + 1} OF {totalItems}
              </span>
              {pinnedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-300">
                  <Pin className="w-2.5 h-2.5 text-amber-600" />
                  {pinnedCount} PINNED
                </span>
              )}
            </div>

            {/* Dynamic Progress Arc Donut Chart */}
            <div className="flex items-center gap-3">
              <div 
                id="modal-header-donut-progress"
                className="relative flex items-center justify-center shrink-0" 
                style={{ width: donutSize, height: donutSize }}
                title={`Progress: ${percentComplete}% completed (${doneCount} done, ${skippedCount} skipped, ${missedCount + incorrectlyCount} non-compliant)`}
              >
                <svg width={donutSize} height={donutSize} className="transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx={donutSize / 2}
                    cy={donutSize / 2}
                    r={donutRadius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={donutStrokeWidth}
                  />
                  {/* Compliant Done Arc (Emerald) */}
                  {strokeDone > 0 && (
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={donutStrokeWidth}
                      strokeDasharray={`${strokeDone} ${donutCircumference}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      className="transition-all duration-300 ease-out"
                    />
                  )}
                  {/* Exception Skipped/Pinned Arc (Amber) */}
                  {strokeExceptions > 0 && (
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={donutStrokeWidth}
                      strokeDasharray={`${strokeExceptions} ${donutCircumference}`}
                      strokeDashoffset={-strokeDone}
                      strokeLinecap="round"
                      className="transition-all duration-300 ease-out"
                    />
                  )}
                  {/* Non-compliance Issues Arc (Rose) */}
                  {strokeIssues > 0 && (
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth={donutStrokeWidth}
                      strokeDasharray={`${strokeIssues} ${donutCircumference}`}
                      strokeDashoffset={-(strokeDone + strokeExceptions)}
                      strokeLinecap="round"
                      className="transition-all duration-300 ease-out"
                    />
                  )}
                </svg>
                <span className="absolute text-[9px] font-mono font-black text-slate-800 leading-none">
                  {percentComplete}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1">
                  <span>Done: <strong className="text-emerald-700 font-bold">{doneCount}</strong></span>
                  <span>·</span>
                  <span>Skip: <strong className="text-slate-700 font-semibold">{skippedCount}</strong></span>
                  {mandatorySkippedCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                      ⚠️ {mandatorySkippedCount} Mand. Skip
                    </span>
                  )}
                  {(missedCount > 0 || incorrectlyCount > 0) && (
                    <>
                      <span>·</span>
                      <span className="text-rose-700 font-bold">Issues: {missedCount + incorrectlyCount}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Carousel Body: Major portion dedicated to Checklist Item Details with Zero Space Waste */}
          <div className="p-2 sm:p-3 md:p-4 flex-1 overflow-hidden flex flex-col justify-between space-y-2 bg-slate-50/50 min-h-0">
            {/* Skip Warning Alert Toast */}
            {skipAlert && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-start gap-2 animate-in shake shadow-2xs shrink-0">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-900">Action Restricted by Safety Rule</div>
                  <div className="text-rose-800 leading-tight">{skipAlert}</div>
                </div>
                <button 
                  onClick={() => setSkipAlert(null)}
                  className="ml-auto text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Prominent Focused Item Card Taking Up Dominant Major Portion of Screen */}
            {currentItem && (
              <div className="relative overflow-hidden rounded-xl sm:rounded-2xl flex-1 flex flex-col min-h-0">
                {/* Swipe Left Background Action Indicator (Mark Done) */}
                <div 
                  className={`absolute inset-0 bg-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-end px-6 text-white font-black text-sm tracking-wider transition-opacity duration-150 ${
                    dragOffsetX < 0 ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <div className="flex items-center gap-2 transform transition-transform" style={{ transform: `scale(${Math.min(1.25, 0.8 + Math.abs(dragOffsetX) / 80)})` }}>
                    <span className="uppercase text-xs font-mono font-extrabold">Mark Done</span>
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white stroke-[3]" />
                    </div>
                  </div>
                </div>

                {/* Swipe Right Background Action Indicator (Previous Item) */}
                <div 
                  className={`absolute inset-0 bg-slate-700 rounded-xl sm:rounded-2xl flex items-center justify-start px-6 text-white font-bold text-sm tracking-wider transition-opacity duration-150 ${
                    dragOffsetX > 0 ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <div className="flex items-center gap-2 transform transition-transform" style={{ transform: `scale(${Math.min(1.25, 0.8 + Math.abs(dragOffsetX) / 80)})` }}>
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center">
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </div>
                    <span className="uppercase text-xs font-mono">Previous</span>
                  </div>
                </div>

                {/* Card Container with Adaptive Typography and Flex Expansion */}
                <div 
                  id={`carousel-card-item-${currentIndex}`}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  style={{
                    transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : 'translateX(0)',
                    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className={`bg-white border-2 rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-6 flex flex-col justify-between shadow-sm relative flex-1 min-h-0 select-none touch-pan-y z-10 ${
                    isRubberbanding ? 'animate-rubberband-bounce' : ''
                  } ${
                    currentItem.status === 'missed' || currentItem.status === 'incorrectly_executed'
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : currentItem.status === 'done'
                      ? 'border-emerald-300'
                      : 'border-slate-200'
                  }`}
                >
                  {/* End of Checklist Prompt Overlay in Standard View */}
                  {showEndOfChecklistPrompt && (
                    <div className="absolute inset-2 sm:inset-4 bg-slate-900/95 border-2 border-amber-400 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-2xl backdrop-blur-md flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 animate-in zoom-in-95 duration-200 z-30">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md">
                        <SkipForward className="w-6 h-6 animate-pulse" />
                      </div>

                      <div className="space-y-1 max-w-md">
                        <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                          Checklist Boundary Reached
                        </span>
                        <h3 className="text-base sm:text-lg md:text-xl font-black text-white">
                          You have reached the end of the checklist.
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 font-medium">
                          Do you want to navigate to skipped items?
                        </p>
                      </div>

                      {/* Skipped / Pinned Counts */}
                      <div className="flex items-center justify-center gap-2 text-xs font-mono flex-wrap">
                        {skippedCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                            {skippedCount} Skipped
                          </span>
                        )}
                        {pinnedCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/60 text-amber-300 font-bold">
                            {pinnedCount} Pinned
                          </span>
                        )}
                        {notDoneCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-600/60 text-blue-300 font-bold">
                            {notDoneCount} Incomplete
                          </span>
                        )}
                      </div>

                      {/* Navigation confirmation buttons */}
                      <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                        <button
                          id="btn-confirm-navigate-skipped-standard"
                          type="button"
                          onClick={navigateToFirstSkippedOrPinned}
                          className="btn-3d-amber px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Yes, Navigate to Skipped Items</span>
                        </button>

                        <button
                          id="btn-dismiss-navigate-skipped-standard"
                          type="button"
                          onClick={() => setShowEndOfChecklistPrompt(false)}
                          className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95"
                        >
                          Dismiss
                        </button>
                      </div>

                      <p className="text-[10px] sm:text-[11px] font-mono text-amber-300/80">
                        👉 Swipe left again or press [Y] / [Enter] to navigate
                      </p>
                    </div>
                  )}

                  {/* Card Meta Badges */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5 pb-2 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs sm:text-sm font-black flex items-center justify-center shadow-2xs">
                        ITEM #{currentItem.sequenceOrder}
                      </span>
                      <span className="text-[11px] font-mono font-bold uppercase text-slate-500 hidden sm:inline">
                        Checklist Item Details
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {currentItem.isMandatory ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] sm:text-xs font-black uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          Mandatory
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] sm:text-xs font-bold uppercase">
                          Optional
                        </span>
                      )}

                      {/* Status Indicator */}
                      {currentItem.status === 'done' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] sm:text-xs font-black uppercase tracking-wider animate-in zoom-in-95">
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> DONE
                        </span>
                      )}
                      {currentItem.status === 'pinned' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] sm:text-xs font-black uppercase tracking-wider">
                          <Pin className="w-3 h-3 text-amber-600" /> PINNED
                        </span>
                      )}
                      {currentItem.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-bold border border-slate-200 uppercase">
                          SKIPPED
                        </span>
                      )}
                      {currentItem.status === 'missed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[11px] sm:text-xs font-extrabold shadow-2xs">
                          <X className="w-3 h-3 text-rose-600 stroke-[3]" /> MISSED ❌
                        </span>
                      )}
                      {currentItem.status === 'incorrectly_executed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-rose-900 border border-rose-300 text-[11px] sm:text-xs font-extrabold shadow-2xs">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> INCORRECT ❌
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsFullScreen(true)}
                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                        title="Enter Full Screen View"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Checklist Item Details Displayed Prominently in Major Portion of Screen with Adaptive Sizing */}
                  <div className="py-2 sm:py-4 flex-1 flex flex-col justify-center overflow-y-auto pr-1 scrollbar-thin min-h-0">
                    <p className={`${getAdaptiveFontClass(currentItem.text, false)} font-black text-slate-900 leading-tight sm:leading-snug tracking-tight break-words select-text`}>
                      {currentItem.text}
                    </p>

                    {currentItem.skipReason && (
                      <p className="mt-2 text-xs sm:text-sm text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                        Skip Note: {currentItem.skipReason}
                      </p>
                    )}
                    {currentItem.remark && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 space-y-0.5">
                        <span className="font-bold flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
                          Operator Non-Compliance Remark:
                        </span>
                        <p className="font-mono text-rose-950 font-medium">{currentItem.remark}</p>
                      </div>
                    )}
                  </div>

                  {/* Swipe Done Success Toast overlay in standard view */}
                  {showSwipeDoneToast && (
                    <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xs rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-white p-4 animate-in zoom-in-95 duration-150 z-20">
                      <div className="w-10 h-10 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg mb-1.5">
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                      <span className="text-sm sm:text-base font-black tracking-wide">ITEM MARKED DONE</span>
                      <span className="text-xs text-emerald-100 font-mono mt-0.5">Advancing to next task...</span>
                    </div>
                  )}

                  {/* Card Bottom Nav Arrows */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-100 shrink-0">
                    <button
                      id="btn-prev-card"
                      onClick={goToPrev}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition py-0.5 px-2 rounded font-semibold cursor-pointer active:scale-95 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>

                    <span className="font-mono text-[10px] text-slate-400 text-center">
                      <span className="hidden sm:inline">Shortcuts: [D] Done · [F] Full Screen · [P] Pin · [S] Skip</span>
                      <span className="inline sm:hidden">Swipe Left = Done</span>
                    </span>

                    <button
                      id="btn-next-card"
                      onClick={goToNext}
                      disabled={currentIndex === totalItems - 1}
                      className="flex items-center gap-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition py-0.5 px-2 rounded font-semibold cursor-pointer active:scale-95 text-xs"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Control Deck (Slim & Responsive) */}
            <div className="space-y-1 shrink-0">
              {/* Row 1: Primary Actions (DONE, PIN, SKIP) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {/* DONE Button */}
                <button
                  id="btn-action-done"
                  type="button"
                  disabled={isShiftClosed}
                  onClick={handleMarkDone}
                  className={`py-2 px-2.5 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    currentItem?.status === 'done'
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>DONE (Mark Checked)</span>
                </button>

                {/* PIN Button */}
                <button
                  id="btn-action-pin"
                  type="button"
                  disabled={isShiftClosed}
                  onClick={handlePinItem}
                  className={`py-2 px-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    currentItem?.status === 'pinned'
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-black'
                      : 'bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800'
                  }`}
                  title="Defer processing to complete later"
                >
                  <Pin className="w-3.5 h-3.5 text-amber-700" />
                  <span>PIN (Defer Card)</span>
                </button>

                {/* SKIP Button */}
                <button
                  id="btn-action-skip"
                  type="button"
                  disabled={isShiftClosed}
                  onClick={handleAttemptSkip}
                  className={`py-2 px-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition border disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    currentItem?.isMandatory
                      ? 'bg-slate-100 border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title={currentItem?.isMandatory ? 'Mandatory items cannot be skipped' : 'Skip optional item'}
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>SKIP {currentItem?.isMandatory ? '(Restricted)' : '(Optional)'}</span>
                </button>
              </div>

              {/* Row 2: Non-Compliance Options (Marked with Red Cross) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {/* MISSED Button (Red Cross) */}
                <button
                  id="btn-action-missed"
                  type="button"
                  disabled={isShiftClosed}
                  onClick={() => handleOpenNonComplianceModal('missed')}
                  className={`py-1.5 px-2.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition border shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    currentItem?.status === 'missed'
                      ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-400'
                      : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800 hover:border-rose-400'
                  }`}
                  title="Mark item as Missed with mandatory remark"
                >
                  <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                  <span>❌ MISSED ITEM (Remark)</span>
                </button>

                {/* INCORRECTLY EXECUTED Button (Red Cross) */}
                <button
                  id="btn-action-incorrect"
                  type="button"
                  disabled={isShiftClosed}
                  onClick={() => handleOpenNonComplianceModal('incorrectly_executed')}
                  className={`py-1.5 px-2.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 transition border shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    currentItem?.status === 'incorrectly_executed'
                      ? 'bg-rose-900 text-white border-rose-950 ring-2 ring-rose-400'
                      : 'bg-amber-50 hover:bg-rose-100 border-rose-300 text-rose-900 hover:border-rose-400'
                  }`}
                  title="Mark item as Incorrectly Executed with mandatory remark"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>❌ INCORRECT (Remark)</span>
                </button>
              </div>
            </div>

            {/* Compact Bottom Card Overview Navigator */}
            <div className="space-y-0.5 pt-0.5 shrink-0">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Card Navigator ({currentIndex + 1}/{totalItems}):</span>
                <span className="font-normal text-slate-400">Click item to jump</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                {items.map((item, idx) => {
                  const isActive = idx === currentIndex;
                  let bgClass = 'bg-white border-slate-200 text-slate-700';
                  if (item.status === 'done') bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                  else if (item.status === 'pinned') bgClass = 'bg-amber-50 border-amber-300 text-amber-900';
                  else if (item.status === 'skipped') bgClass = 'bg-slate-100 border-slate-200 text-slate-400';
                  else if (item.status === 'missed' || item.status === 'incorrectly_executed') bgClass = 'bg-rose-100 border-rose-300 text-rose-900 font-extrabold';

                  return (
                    <button
                      key={`${item.id}-${idx}`}
                      id={`btn-jump-card-${idx}`}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setSkipAlert(null);
                      }}
                      className={`min-w-[28px] h-6 rounded-md border text-[11px] font-mono font-bold flex items-center justify-center gap-0.5 px-1 transition shrink-0 cursor-pointer ${bgClass} ${
                        isActive ? 'ring-2 ring-blue-600 font-black scale-105 shadow-xs' : 'hover:border-slate-400'
                      }`}
                      title={`Jump to item ${idx + 1}: ${item.text.slice(0, 40)}...`}
                    >
                      <span>{idx + 1}</span>
                      {item.status === 'done' && <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                      {item.status === 'pinned' && <Pin className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                      {(item.status === 'missed' || item.status === 'incorrectly_executed') && <X className="w-2.5 h-2.5 text-rose-600 stroke-[3] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Streamlined Footer with Final Submit Action */}
          <div className="px-3 py-1.5 sm:px-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
            <div className="text-xs text-slate-600 text-center sm:text-left">
              {!canSubmit ? (
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>
                    Cannot submit:{' '}
                    {notDoneCount > 0 && `${notDoneCount} pending `}
                    {pinnedCount > 0 && `${pinnedCount} pinned unresolved`}
                  </span>
                </span>
              ) : (missedCount > 0 || incorrectlyCount > 0) ? (
                <span className="text-rose-900 font-extrabold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                  <X className="w-3 h-3 text-rose-600 stroke-[3] shrink-0" />
                  <span>
                    Completed with Missed/Incorrect ({missedCount > 0 ? `${missedCount} Missed` : ''}{missedCount > 0 && incorrectlyCount > 0 ? ', ' : ''}{incorrectlyCount > 0 ? `${incorrectlyCount} Incorrect` : ''})
                  </span>
                </span>
              ) : (
                <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>All items processed. Ready for submission.</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isShiftClosed ? (
                <button
                  id="btn-close-readonly"
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Close (Read Only Mode)
                </button>
              ) : (
                <>
                  <button
                    id="btn-save-draft"
                    type="button"
                    onClick={handleSaveProgressDraft}
                    className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Save Draft & Exit
                  </button>

                  <button
                    id="btn-complete-submit-checklist"
                    type="button"
                    onClick={handleOpenRemarksModal}
                    disabled={!canSubmit}
                    className={`w-full sm:w-auto px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition cursor-pointer ${
                      canSubmit
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    <span>Submit Checklist</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Non-Compliance Remark Sub-Modal (For Missed & Incorrectly Executed) */}
      {isNonComplianceModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div 
            id="non-compliance-remark-modal-container"
            className="w-full max-w-md bg-white border border-rose-300 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center font-extrabold text-lg">
                ❌
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {nonComplianceType === 'missed' ? 'Record Missed Checklist Item' : 'Record Incorrectly Executed Item'}
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Mandatory Operational Rationale / Failure Details
                </p>
              </div>
            </div>

            {nonComplianceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{nonComplianceError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Item: <span className="text-slate-900 font-mono">#{currentItem?.sequenceOrder} {currentItem?.text}</span>
              </label>
              <textarea
                id="input-non-compliance-remark"
                rows={3}
                placeholder={
                  nonComplianceType === 'missed'
                    ? 'Enter operational rationale for missing this item (e.g., Gate congestion, GSE unavailability, bypass authorized by Duty Manager)...'
                    : 'Enter details of incorrect execution (e.g., Pressure setting off by 5 PSI, incorrect hose coupled, re-checked and adjusted)...'
                }
                value={nonComplianceRemarkText}
                onChange={(e) => setNonComplianceRemarkText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white placeholder:text-slate-400 font-sans"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNonComplianceModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-non-compliance"
                type="button"
                onClick={handleConfirmNonCompliance}
                className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <span>Save Remark & Mark {nonComplianceType === 'missed' ? 'Missed' : 'Incorrect'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Reason Sub-Modal (Mandatory & Optional) */}
      {isSkipReasonModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              {isSkippingMandatory ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">Mandatory Safety Check Skip</h3>
                    <span className="text-[10px] font-mono text-amber-700 uppercase font-black tracking-wider">Supervisor Authorization Required</span>
                  </div>
                </>
              ) : (
                <>
                  <HelpCircle className="w-5 h-5 text-sky-600" />
                  <h3 className="text-sm font-bold">Optional Item Skip Note</h3>
                </>
              )}
            </div>

            {isSkippingMandatory ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong className="font-bold">Airside Safety Rule:</strong> This item is designated as <span className="underline font-bold">MANDATORY</span>. To bypass, you must record an operational justification or supervisor authorization note:
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Please specify the operational rationale for skipping this optional check (e.g. equipment not fitted, stand bypass):
              </p>
            )}

            {skipReasonError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-1.5 animate-in shake">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{skipReasonError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                {isSkippingMandatory ? 'Reason / Justification for Skipping (Mandatory)' : 'Skip Reason (Optional)'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  isSkippingMandatory
                    ? 'e.g. Authorized by Duty Supervisor due to stand B14 bridge malfunction; manual visual inspection confirmed.'
                    : 'e.g. Not applicable to this flight configuration'
                }
                value={skipReasonText}
                onChange={(e) => {
                  setSkipReasonText(e.target.value);
                  if (skipReasonError) setSkipReasonError(null);
                }}
                className={`w-full p-3 bg-slate-50 border ${
                  isSkippingMandatory && !skipReasonText.trim() ? 'border-amber-300' : 'border-slate-200'
                } rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white placeholder:text-slate-400 font-sans`}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSkipReasonModalOpen(false);
                  setSkipReasonError(null);
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-skip"
                type="button"
                onClick={handleConfirmSkip}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 ${
                  isSkippingMandatory
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSkippingMandatory ? 'Authorize & Confirm Skip' : 'Confirm Skip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free-Text Remarks Mandatory Modal on Final Submit */}
      {isRemarksModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div 
            id="mandatory-remarks-modal-container"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-900 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Checklist Summary & Remarks (Mandatory)</h3>
                <p className="text-xs text-slate-500">
                  Review checklist items status summary and record operational remarks before sign-off
                </p>
              </div>
            </div>

            {/* Checklist Execution Status Summary Breakdown */}
            <div className="space-y-2.5">
              {/* 1. Compliant Items summary */}
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <span className="flex items-center gap-1.5 font-bold">
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                  Compliant Items Done:
                </span>
                <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                  {doneCount} / {totalItems}
                </span>
              </div>

              {/* 2. Mandatory Items Skipped Breakdown */}
              {mandatorySkippedCount > 0 && (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 text-xs text-amber-950 shadow-2xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      Mandatory Safety Items Skipped ({mandatorySkippedCount})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono font-black">
                      BYPASS LOGGED
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {mandatorySkippedItems.map((item, idx) => (
                      <div key={item.id || idx} className="p-2 bg-white rounded-lg border border-amber-200 text-[11px] space-y-0.5">
                        <div className="font-bold text-slate-900 line-clamp-2">
                          #{item.sequenceOrder}. {item.text}
                        </div>
                        <div className="text-amber-800 font-medium">
                          <span className="font-bold">Reason:</span> {item.skipReason || 'Operational justification logged by operator'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Non-Compliant Items Breakdown (Missed or Incorrectly Executed) */}
              {nonCompliantItems.length > 0 && (
                <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2 text-xs text-rose-950 shadow-2xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Non-Compliant Items ({nonCompliantItems.length})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 font-mono font-black">
                      NON-COMPLIANCE
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {nonCompliantItems.map((item, idx) => (
                      <div key={item.id || idx} className="p-2 bg-white rounded-lg border border-rose-200 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 line-clamp-1">
                            #{item.sequenceOrder}. {item.text}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            item.status === 'missed' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {item.status === 'missed' ? 'Missed' : 'Incorrect'}
                          </span>
                        </div>
                        <div className="text-rose-800 font-medium font-mono text-[10px]">
                          <span className="font-bold">Remark:</span> {item.remark || 'Flagged during execution'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Optional Skipped Items Summary */}
              {optionalSkippedCount > 0 && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    Optional Items Skipped:
                  </span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {optionalSkippedCount}
                  </span>
                </div>
              )}
            </div>

            {remarksError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{remarksError}</span>
              </div>
            )}

            {/* Cloud Sync Failure Prompt with Retry */}
            {cloudSyncError && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <CloudOff className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-rose-950">Firestore Cloud Sync Failed</div>
                    <p className="text-rose-800 text-[11px] leading-relaxed">
                      {cloudSyncError}
                    </p>
                    <p className="text-rose-900 font-semibold text-[11px]">
                      Data is not saved to the cloud yet. Please retry submission to ensure the Firestore database is fully updated and in sync before confirming completion.
                    </p>
                  </div>
                </div>
                <div className="pt-1 flex justify-end">
                  <button
                    id="btn-retry-cloud-sync"
                    type="button"
                    disabled={isSubmittingToCloud}
                    onClick={handleFinalSubmit}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isSubmittingToCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Retry Cloud Submission & Sync</span>
                  </button>
                </div>
              </div>
            )}

            {/* Cloud Sync in progress */}
            {isSubmittingToCloud && (
              <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs rounded-xl flex items-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
                <span className="font-semibold">Saving & verifying synchronization with Firestore Cloud Database...</span>
              </div>
            )}

            {/* Cloud Sync Success Banner */}
            {isCloudSyncSuccess && (
              <div className="p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs rounded-xl flex items-center gap-2.5 animate-in zoom-in-95">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold">✓ Firestore Cloud Verified & Synced!</div>
                  <p className="text-[11px] text-emerald-800">Checklist successfully saved and confirmed with Firestore cloud database.</p>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Ground Execution Notes & Aircraft Handover Remarks (Mandatory)
              </label>
              <textarea
                id="input-checklist-remarks"
                rows={3}
                placeholder="e.g. Stand B14. Chocks positioned, GPU connected, fuel hydrometer verified at 0.804 SG. Captain acknowledged and signed final electronic loadsheet with zero discrepancies."
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white placeholder:text-slate-400 leading-relaxed font-sans"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                Logged under your U-Number credential: <strong className="text-slate-800 font-bold">{currentUser?.uNumber || 'Operator'}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingToCloud || isCloudSyncSuccess}
                onClick={() => setIsRemarksModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Back to Cards
              </button>

              <button
                id="btn-confirm-final-submit"
                type="button"
                disabled={isSubmittingToCloud || isCloudSyncSuccess}
                onClick={handleFinalSubmit}
                className={`px-6 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2 ${
                  isCloudSyncSuccess
                    ? 'bg-emerald-700 text-white cursor-default'
                    : isSubmittingToCloud
                    ? 'bg-sky-600 text-white cursor-wait opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                }`}
              >
                {isSubmittingToCloud ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Cloud Sync...</span>
                  </>
                ) : isCloudSyncSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Cloud Synced & Completed!</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Authorize & Sign Checklist</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Read-Only Modal */}
      {isViewAllModalOpen && (
        <div className="fixed inset-6 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white mb-1 inline-block">
                  Read-Only Mode
                </span>
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>{checklist.title} - All Points</span>
                  <span className="text-xs font-mono font-normal opacity-80">({totalItems} items)</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {groupName} / {subGroupName}
                </p>
              </div>
              <button
                onClick={() => setIsViewAllModalOpen(false)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
                title="Close View All"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable list */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 bg-slate-50 flex-1">
              {items.map((item, idx) => (
                <div 
                  key={`${item.id || 'item'}-${idx}`}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center">
                        #{item.sequenceOrder}
                      </span>
                      {item.isMandatory ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded uppercase">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">
                          Optional
                        </span>
                      )}
                    </div>

                    <div>
                      {item.status === 'done' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                          <Check className="w-3 h-3 text-emerald-600" /> DONE
                        </span>
                      )}
                      {item.status === 'pinned' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                          <Pin className="w-3 h-3 text-amber-600" /> PINNED
                        </span>
                      )}
                      {item.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                          SKIPPED
                        </span>
                      )}
                      {item.status === 'missed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-extrabold">
                          <X className="w-3 h-3 text-rose-600 stroke-[3]" /> MISSED ❌
                        </span>
                      )}
                      {item.status === 'incorrectly_executed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-rose-900 border border-rose-300 text-xs font-extrabold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> INCORRECTLY EXECUTED ❌
                        </span>
                      )}
                      {item.status === 'not_done' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-slate-900 leading-relaxed">
                    {item.text}
                  </p>

                  {(item.actionBy || item.skipReason || item.remark || item.actionAt) && (
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                      {item.actionBy && (
                        <span>By: <strong className="text-slate-700">{item.actionBy}</strong></span>
                      )}
                      {item.skipReason && (
                        <span className="text-amber-800 italic">Skip Note: {item.skipReason}</span>
                      )}
                      {item.remark && (
                        <span className="text-rose-900 font-medium">Remark: {item.remark}</span>
                      )}
                      {item.actionAt && (
                        <span className="font-mono text-[11px]">
                          {new Date(item.actionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-mono">
                Read-Only Overview
              </span>
              <button
                onClick={() => setIsViewAllModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Close View All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Navigation Toast (e.g. Navigated to Skipped/Pinned Item) */}
      {navigationToastText && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-xl bg-slate-900/95 text-amber-300 border-2 border-amber-400 font-mono text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-200">
          <RotateCcw className="w-4 h-4 text-amber-400 animate-spin" style={{ animationIterationCount: 1, animationDuration: '0.6s' }} />
          <span>{navigationToastText}</span>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
