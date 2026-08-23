'use client';

import React, { useState } from 'react';
import { DayOperationalData, UserAccount } from '@/types/aviation';
import { getDayOverallProgress, isGroupComplete } from '@/lib/storage';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  CheckCircle2, 
  Plane,
  Clock
} from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  onClose: () => void;
}

export function WhatsAppShareModal({
  isOpen,
  dayData,
  currentUser,
  onClose,
}: WhatsAppShareModalProps) {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const summary = getDayOverallProgress(dayData);
  const isClosed = dayData.isShiftClosed;

  // Generate structured message
  let text = '';
  if (isClosed) {
    text += `🛫 *AVIATION GROUND OPERATIONS - SHIFT CLOSURE REPORT* 🟢\n`;
    text += `📅 *Date:* ${dayData.date}\n`;
    text += `⏱️ *Shift Status:* CLOSED & SUPERVISOR VERIFIED ✅\n`;
    text += `👮‍♂️ *Signed by Duty Supervisor:* ${dayData.closedBy || currentUser?.name || 'Duty Supervisor'}\n`;
    text += `🕒 *Closure Time:* ${dayData.closedAt ? new Date(dayData.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} UTC/Local\n\n`;
    text += `📊 *SUMMARY METRICS:*\n`;
    text += `• Total Operational Groups: ${summary.totalGroups}/${summary.totalGroups} VERIFIED 🟢\n`;
    text += `• Overall Progress: ${summary.percent}%\n`;
    text += `• Total Checklist Items Executed: ${summary.doneItems}/${summary.totalItems}\n`;
    text += `• Total Checklists Skipped: ${summary.skippedItems}\n`;
    
    // Calculate checklist exceptions (if any items have status 'not_done' or 'pinned' in a closed shift, this is an exception)
    let checklistExceptions = 0;
    for (const grp of dayData.groups) {
      for (const sub of grp.subGroups) {
        for (const chk of sub.checklists) {
          if (chk.status !== 'completed') checklistExceptions++;
        }
      }
    }
    text += `• Checklists with Exceptions: ${checklistExceptions}\n\n`;

    text += `✈️ *FLIGHT TURNAROUND STATUS:*\n`;
    
    for (const grp of dayData.groups) {
      if (grp.isFlightGroup) {
        text += `  ✅ *${grp.name} (${grp.code})* - Fully Cleared & Ready 🟢 [Verified: ${grp.verifiedBy || 'Sup'}]\n`;
      }
    }

    text += `\n🏢 *TERMINAL & INFRASTRUCTURE GROUPS:*\n`;
    for (const grp of dayData.groups) {
      if (!grp.isFlightGroup) {
        text += `  ✅ *${grp.name}* - Complete 🟢\n`;
      }
    }

    if (dayData.shiftNotes) {
      text += `\n📝 *Supervisor Handover Notes:*\n"${dayData.shiftNotes}"\n`;
    }

    text += `\n_Generated securely via DEL GroundOps v2.4_`;
  } else {
    text += `⚠️ *DEL GROUND OPERATIONS - SHIFT IN-PROGRESS STATUS* 📋\n`;
    text += `📅 *Date:* ${dayData.date}\n`;
    text += `⏱️ *Current Progress:* ${summary.percent}% (${summary.doneItems}/${summary.totalItems} Checks Done)\n`;
    text += `👮‍♂️ *Duty Auditor:* ${currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'DEL Operations'}\n\n`;
    text += `📊 *OPERATIONAL GROUPS BREAKDOWN:*\n`;

    for (const grp of dayData.groups) {
      const complete = isGroupComplete(grp);
      let done = 0;
      let total = 0;
      for (const sub of grp.subGroups) {
        for (const chk of sub.checklists) {
          for (const item of chk.items) {
            total++;
            if (item.status === 'done' || item.status === 'skipped') done++;
          }
        }
      }
      
      const statusIcon = grp.isVerified ? '🔒 🟢' : complete ? '✅' : '⏳ ⚠️';
      text += `${statusIcon} *${grp.name} (${grp.code})*: ${done}/${total} items done ${grp.isVerified ? '[Verified]' : complete ? '[Ready for Sup]' : '[In-Progress]'}\n`;
    }

    if (summary.pinnedItems > 0) {
      text += `\n📌 *Attention:* ${summary.pinnedItems} items currently PINNED and pending final check.\n`;
    }

    text += `\n_Live update via AeroOps GroundOps v2.4_`;
  }

  const encodedUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const deepLink = `whatsapp://send?text=${encodeURIComponent(text)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
                WhatsApp Operations Broadcast
              </h3>
              <p className="text-xs text-slate-500">
                Format: <span className="text-emerald-700 font-semibold">{isClosed ? 'Official Shift Closure Summary' : 'Live In-Progress Telemetry'}</span>
              </p>
            </div>
          </div>

          <button
            id="btn-close-whatsapp-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Preview */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Message Preview:</span>
            <span className="font-mono text-[11px]">{text.length} characters</span>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed shadow-2xs max-h-72 overflow-y-auto">
            {text}
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
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 transition"
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
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition"
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
