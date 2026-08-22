'use client';

import React from 'react';
import { DayOperationalData, UserAccount } from '@/types/aviation';
import { getDayOverallProgress, isGroupComplete } from '@/lib/storage';
import { 
  Plane, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Share2, 
  FileSpreadsheet, 
  Stethoscope, 
  Sliders, 
  Lock, 
  AlertCircle 
} from 'lucide-react';

interface ShiftOverviewBannerProps {
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  onOpenDiagnosis: (groupId?: string) => void;
  onOpenWhatsApp: () => void;
  onExportExcel: () => void;
  onOpenAdmin: () => void;
  onReopenShift?: () => void;
}

export function ShiftOverviewBanner({
  dayData,
  currentUser,
  onOpenDiagnosis,
  onOpenWhatsApp,
  onExportExcel,
  onOpenAdmin,
  onReopenShift,
}: ShiftOverviewBannerProps) {
  const progress = getDayOverallProgress(dayData);
  const isSupervisor = currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';
  const [showReopenConfirm, setShowReopenConfirm] = React.useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm text-slate-900 space-y-5">
      {/* Top Banner: Shift State & Action Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              SHIFT DATE: {dayData.date}
            </span>

            {dayData.isShiftClosed ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wide">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  Shift Verified & Closed
                </span>
                {isSupervisor && onReopenShift && (
                  <button
                    id="btn-banner-reopen-shift"
                    onClick={() => {
                      if (!showReopenConfirm) {
                        setShowReopenConfirm(true);
                        setTimeout(() => setShowReopenConfirm(false), 5000);
                      } else {
                        onReopenShift();
                        setShowReopenConfirm(false);
                      }
                    }}
                    className={`px-2.5 py-1 border rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                      showReopenConfirm
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-slate-950 animate-pulse font-extrabold'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                    }`}
                    title="Reopen Shift"
                  >
                    {showReopenConfirm ? 'Confirm Reopen' : 'Reopen Shift'}
                  </button>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wide">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                Shift In-Progress
              </span>
            )}

            {dayData.closedBy && (
              <span className="text-xs text-slate-500">
                Closed by: <strong className="text-slate-700 font-semibold">{dayData.closedBy}</strong>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            DEL Ground Ops Turnaround Checklists Control
          </h2>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          {isSupervisor && (
            <button
              id="btn-open-diagnosis"
              onClick={() => onOpenDiagnosis()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition shadow-2xs"
              title="Supervisor Diagnosis Mode"
            >
              <Stethoscope className="w-4 h-4 text-amber-600" />
              <span>Diagnosis Mode</span>
            </button>
          )}

          <button
            id="btn-open-whatsapp"
            onClick={onOpenWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs"
            title="Generate WhatsApp Broadcast"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp Summary</span>
          </button>

          <button
            id="btn-export-excel-log"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold transition"
            title="Download Excel Shift Audit"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Export</span>
          </button>

          {isAdmin && (
            <button
              id="btn-open-admin-panel"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-purple-600/20"
              title="Admin Templates & User Management"
            >
              <Sliders className="w-4 h-4" />
              <span>Admin Management</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Progress */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2 hover:bg-white hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Overall Progress</span>
            <span className="font-mono text-emerald-600 font-bold">{progress.percent}%</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">{progress.doneItems}</span>
            <span className="text-xs text-slate-500 font-mono">/ {progress.totalItems} checks</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        {/* Operational Groups Status */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2 hover:bg-white hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Completed Groups</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">{progress.completedGroups}</span>
            <span className="text-xs text-slate-500 font-mono">/ {progress.totalGroups} active</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {progress.completedGroups === progress.totalGroups ? (
              <span className="text-emerald-700 font-medium">All groups complete</span>
            ) : (
              `${progress.totalGroups - progress.completedGroups} groups pending`
            )}
          </p>
        </div>

        {/* Supervisor Verified Groups */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2 hover:bg-white hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Supervisor Locked</span>
            <ShieldCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">{progress.verifiedGroups}</span>
            <span className="text-xs text-slate-500 font-mono">/ {progress.totalGroups} verified</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {progress.verifiedGroups === progress.totalGroups ? (
              <span className="text-sky-700 font-medium">Full shift verified</span>
            ) : (
              'Pending supervisor sign-off'
            )}
          </p>
        </div>

        {/* Exceptions & Skips */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2 hover:bg-white hover:shadow-xs transition">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Item Exceptions</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {progress.skippedItems + progress.pinnedItems}
            </span>
            <span className="text-xs text-slate-500 font-mono">exceptions</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span>Skipped: <strong className="text-slate-700">{progress.skippedItems}</strong></span>
            <span>·</span>
            <span>Pinned: <strong className="text-amber-700 font-bold">{progress.pinnedItems}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
