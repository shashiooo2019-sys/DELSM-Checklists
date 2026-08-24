'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DayOperationalData, UserAccount } from '@/types/aviation';
import { getDayOverallProgress, isGroupComplete } from '@/lib/storage';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  RotateCcw,
  CheckCircle2, 
  Lock,
  Clock
} from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  dayShiftOnly?: boolean;
  onClose: () => void;
}

export function WhatsAppShareModal({
  isOpen,
  dayData,
  currentUser,
  dayShiftOnly = false,
  onClose,
}: WhatsAppShareModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [includeDayShift, setIncludeDayShift] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string | null>(null);

  // Generate structured message
  const generatedText = useMemo(() => {
    if (!dayData) return '';
    const summary = getDayOverallProgress(dayData);
    const isClosed = dayData.isShiftClosed;
    const dayShiftGroup = dayData.groups.find(
      (g) => g.name.includes('Day Shift') || g.code === 'DAY-OPS'
    );

    let text = '';
    if (dayShiftOnly) {
      const isVerified = dayShiftGroup?.isVerified || false;
      text += `☀️ *DAY SHIFT OPERATIONS (DUTY 2) - STATUS REPORT* 📋\n`;
      text += `📅 *Date:* ${dayData.date}\n`;
      text += `⏱️ *Shift Status:* ${isVerified ? 'SHIFT VERIFIED AND CLOSED ✅' : 'IN-PROGRESS ⏳'}\n`;
      text += `👮‍♂️ *Supervisor:* ${dayShiftGroup?.verifiedBy || (currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Duty Supervisor')}\n`;
      if (dayShiftGroup?.verifiedAt) {
        text += `🕒 *Timestamp:* ${new Date(dayShiftGroup.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} Local\n`;
      }

      // Calculate Day Shift Specific Items
      let totalDayItems = 0;
      let doneDayItems = 0;
      let skippedDayItems = 0;
      let missedDayItems = 0;
      let incorrectDayItems = 0;
      let notDoneDayItems = 0;
      const skippedList: { chk: string; item: string; reason?: string }[] = [];
      const nonComplianceList: { chk: string; item: string; status: string; remark?: string }[] = [];

      if (dayShiftGroup) {
        for (const sub of dayShiftGroup.subGroups || []) {
          for (const chk of sub.checklists || []) {
            for (const item of chk.items || []) {
              totalDayItems++;
              if (item.status === 'done') doneDayItems++;
              else if (item.status === 'skipped') {
                skippedDayItems++;
                skippedList.push({ chk: chk.title, item: item.text, reason: item.skipReason });
              } else if (item.status === 'missed') {
                missedDayItems++;
                nonComplianceList.push({ chk: chk.title, item: item.text, status: 'MISSED ❌', remark: item.remark });
              } else if (item.status === 'incorrectly_executed') {
                incorrectDayItems++;
                nonComplianceList.push({ chk: chk.title, item: item.text, status: 'INCORRECTLY EXECUTED ❌', remark: item.remark });
              } else {
                notDoneDayItems++;
              }
            }
          }
        }
      }

      const percent = totalDayItems > 0 ? Math.round((doneDayItems / totalDayItems) * 100) : 100;

      text += `\n📊 *SUMMARY METRICS:*\n`;
      text += `• Overall Progress: ${percent}%\n`;
      text += `• Total Items Done: ${doneDayItems}/${totalDayItems}\n`;
      text += `• Skipped Items: ${skippedDayItems}\n`;
      text += `• Missed Items: ${missedDayItems}\n`;
      text += `• Incorrectly Executed: ${incorrectDayItems}\n`;
      text += `• Not Done Items: ${notDoneDayItems}\n`;

      text += `\n📋 *DAY SHIFT SUB-OPERATIONS & CHECKLISTS:*\n`;
      if (dayShiftGroup && dayShiftGroup.subGroups.length > 0) {
        for (const sub of dayShiftGroup.subGroups) {
          text += `• *${sub.name.toUpperCase()}*\n`;
          for (const chk of sub.checklists || []) {
            const chkDone = (chk.items || []).filter((i) => i.status === 'done').length;
            const chkMissed = (chk.items || []).filter((i) => i.status === 'missed').length;
            const chkIncorrect = (chk.items || []).filter((i) => i.status === 'incorrectly_executed').length;
            const chkTotal = (chk.items || []).length;
            
            let statusLabel = chk.status.toUpperCase();
            if (chkMissed > 0 || chkIncorrect > 0) {
              statusLabel = `COMPLETED WITH MISSED/INCORRECT EXECUTION (${chkMissed} Missed, ${chkIncorrect} Incorrect)`;
            }

            text += `  - ${chk.title}: *${statusLabel}* (${chkDone}/${chkTotal} done)\n`;
          }
        }
      } else {
        text += `  - No checklists assigned yet.\n`;
      }

      if (nonComplianceList.length > 0) {
        text += `\n❌ *NON-COMPLIANCE AUDIT (MISSED & INCORRECT):*\n`;
        for (const nc of nonComplianceList) {
          text += `  • [${nc.chk}] ${nc.item} -> *${nc.status}*${nc.remark ? `\n    _Remark: ${nc.remark}_` : ''}\n`;
        }
      }

      if (skippedList.length > 0) {
        text += `\n⚠️ *SKIPPED ITEMS AUDIT:*\n`;
        for (const s of skippedList) {
          text += `  • [${s.chk}] ${s.item}${s.reason ? ` _(Reason: ${s.reason})_` : ''}\n`;
        }
      }

      if (dayShiftGroup?.supervisorNotes) {
        text += `\n📝 *Supervisor Handover Notes:*\n"${dayShiftGroup.supervisorNotes}"\n`;
      }

      text += `\n_Generated securely via DEL GroundOps Checklist System_`;
    } else if (isClosed) {
      text += `🛫 *DEL GROUND OPERATIONS - SHIFT CLOSURE REPORT* 🟢\n`;
      text += `📅 *Date:* ${dayData.date}\n`;
      text += `⏱️ *Shift Status:* SHIFT VERIFIED AND CLOSED ✅\n`;
      text += `👮‍♂️ *Signed by Duty Supervisor:* ${dayData.closedBy || currentUser?.name || 'Duty Supervisor'}\n`;
      text += `🕒 *Closure Time:* ${dayData.closedAt ? new Date(dayData.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} Local\n\n`;
      text += `📊 *SUMMARY METRICS:*\n`;
      text += `• Total Operational Groups: ${summary.totalGroups}/${summary.totalGroups} VERIFIED 🟢\n`;
      text += `• Overall Progress: ${summary.percent}%\n`;
      text += `• Total Checklist Items Executed: ${summary.doneItems}/${summary.totalItems}\n`;
      text += `• Total Items Skipped: ${summary.skippedItems}\n`;
      text += `• Total Items Missed: ${summary.missedItems}\n`;
      text += `• Total Items Incorrectly Executed: ${summary.incorrectItems}\n`;

      const nonComplianceListAll: { chk: string; item: string; status: string; remark?: string }[] = [];
      let checklistExceptions = 0;

      for (const grp of dayData.groups) {
        if (!includeDayShift && (grp.name.includes('Day Shift') || grp.code === 'DAY-OPS')) continue;
        for (const sub of grp.subGroups || []) {
          for (const chk of sub.checklists || []) {
            if (chk.status !== 'completed') checklistExceptions++;
            for (const item of chk.items || []) {
              if (item.status === 'missed') {
                nonComplianceListAll.push({ chk: chk.title, item: item.text, status: 'MISSED ❌', remark: item.remark });
              } else if (item.status === 'incorrectly_executed') {
                nonComplianceListAll.push({ chk: chk.title, item: item.text, status: 'INCORRECTLY EXECUTED ❌', remark: item.remark });
              }
            }
          }
        }
      }
      text += `• Checklists with Exceptions: ${checklistExceptions}\n`;

      if (nonComplianceListAll.length > 0) {
        text += `\n❌ *NON-COMPLIANCE AUDIT LOG (MISSED/INCORRECT):*\n`;
        for (const nc of nonComplianceListAll) {
          text += `  • [${nc.chk}] ${nc.item} -> *${nc.status}*${nc.remark ? `\n    _Remark: ${nc.remark}_` : ''}\n`;
        }
      }

      text += `\n✈️ *FLIGHT TURNAROUND STATUS:*\n`;
      for (const grp of dayData.groups) {
        if (grp.isFlightGroup) {
          text += `  ✅ *${grp.name} (${grp.code})* - Fully Cleared & Ready 🟢 [Verified: ${grp.verifiedBy || 'Supervisor'}]\n`;
        }
      }

      text += `\n🏢 *TERMINAL & INFRASTRUCTURE GROUPS:*\n`;
      for (const grp of dayData.groups) {
        if (!grp.isFlightGroup) {
          if (!includeDayShift && (grp.name.includes('Day Shift') || grp.code === 'DAY-OPS')) continue;
          text += `  ✅ *${grp.name}* - ${grp.isVerified ? 'Shift Verified & Closed 🟢' : 'Complete 🟢'}\n`;
        }
      }

      if (dayData.shiftNotes) {
        text += `\n📝 *Supervisor Handover Notes:*\n"${dayData.shiftNotes}"\n`;
      }

      text += `\n_Generated securely via DEL GroundOps Checklist System_`;
    } else {
      text += `⚠️ *DEL GROUND OPERATIONS - SHIFT IN-PROGRESS STATUS* 📋\n`;
      text += `📅 *Date:* ${dayData.date}\n`;
      text += `⏱️ *Current Progress:* ${summary.percent}% (${summary.doneItems}/${summary.totalItems} Checks Done)\n`;
      text += `👮‍♂️ *Duty Auditor:* ${currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'DEL Ground Operations'}\n\n`;
      text += `📊 *OPERATIONAL GROUPS BREAKDOWN:*\n`;

      for (const grp of dayData.groups) {
        if (!includeDayShift && (grp.name.includes('Day Shift') || grp.code === 'DAY-OPS')) continue;
        const complete = isGroupComplete(grp);
        let done = 0;
        let total = 0;
        for (const sub of grp.subGroups || []) {
          for (const chk of sub.checklists || []) {
            for (const item of chk.items || []) {
              total++;
              if (item.status === 'done' || item.status === 'skipped' || item.status === 'missed' || item.status === 'incorrectly_executed') done++;
            }
          }
        }
        
        const statusIcon = grp.isVerified ? '🔒 🟢' : complete ? '✅' : '⏳ ⚠️';
        text += `${statusIcon} *${grp.name} (${grp.code})*: ${done}/${total} items done ${grp.isVerified ? '[Shift Verified & Closed]' : complete ? '[Ready for Sup]' : '[In-Progress]'}\n`;
      }

      if (summary.missedItems > 0 || summary.incorrectItems > 0) {
        text += `\n❌ *Non-Compliance Alert:* ${summary.missedItems} Missed, ${summary.incorrectItems} Incorrectly Executed.\n`;
        for (const grp of dayData.groups) {
          if (!includeDayShift && (grp.name.includes('Day Shift') || grp.code === 'DAY-OPS')) continue;
          for (const sub of grp.subGroups || []) {
            for (const chk of sub.checklists || []) {
              for (const item of chk.items || []) {
                if (item.status === 'missed') {
                  text += `  • [${chk.title}] ${item.text} -> *MISSED ❌*${item.remark ? `\n    _Remark: ${item.remark}_` : ''}\n`;
                } else if (item.status === 'incorrectly_executed') {
                  text += `  • [${chk.title}] ${item.text} -> *INCORRECTLY EXECUTED ❌*${item.remark ? `\n    _Remark: ${item.remark}_` : ''}\n`;
                }
              }
            }
          }
        }
      }

      if (summary.pinnedItems > 0) {
        text += `\n📌 *Attention:* ${summary.pinnedItems} items currently PINNED and pending final check.\n`;
      }

      text += `\n_Live update via DEL GroundOps Checklist System_`;
    }

    return text;
  }, [dayData, currentUser, dayShiftOnly, includeDayShift]);

  if (!isOpen) return null;

  const isCustomEdited = editedText !== null;
  const currentDisplayText = isCustomEdited ? editedText : generatedText;
  const encodedUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(currentDisplayText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentDisplayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetText = () => {
    setEditedText(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        id="whatsapp-share-modal-container"
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {dayShiftOnly ? 'Day Shift (Duty 2) WhatsApp Summary' : 'WhatsApp Operations Broadcast'}
              </h3>
              <p className="text-xs text-slate-500">
                Format: <span className="text-emerald-700 font-semibold">{dayShiftOnly ? 'Day Shift Duty 2 Report' : dayData.isShiftClosed ? 'Official Shift Closure Summary' : 'Live In-Progress Telemetry'}</span>
              </p>
            </div>
          </div>

          <button
            id="btn-close-whatsapp-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Preview & Editor */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {!dayShiftOnly ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-include-day-shift"
                  checked={includeDayShift}
                  onChange={(e) => {
                    setIncludeDayShift(e.target.checked);
                    setEditedText(null);
                  }}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">Include Day Shift Operations in report</span>
              </label>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Operational Group: Day Shift (Duty 2)</span>
                {dayData.groups.find(g => g.name.includes('Day Shift') || g.code === 'DAY-OPS')?.isVerified && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                    SHIFT VERIFIED AND CLOSED
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {isCustomEdited && (
                <button
                  type="button"
                  onClick={handleResetText}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Default</span>
                </button>
              )}
              <span className="font-mono text-[11px] text-slate-500">{currentDisplayText.length} characters</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Message Preview & Editor (exact text to be transmitted on WhatsApp):</span>
              {isCustomEdited && <span className="text-amber-600 font-semibold italic">Customized</span>}
            </div>
            <textarea
              id="textarea-whatsapp-preview"
              value={currentDisplayText}
              onChange={(e) => {
                setEditedText(e.target.value);
              }}
              rows={11}
              className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-emerald-950 leading-relaxed shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
              placeholder="Type or customize your WhatsApp summary..."
            />
          </div>

          <p className="text-xs text-slate-500">
            This message will be dispatched directly to your mobile/web WhatsApp ground operations group chat.
          </p>
        </div>

        {/* Actions Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            id="btn-copy-whatsapp-text"
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              id="link-whatsapp-web"
              href={encodedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Send via WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
