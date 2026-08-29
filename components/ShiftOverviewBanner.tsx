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
  AlertCircle,
  Activity,
  Layers,
  Sparkles,
  ListChecks
} from 'lucide-react';

interface ShiftOverviewBannerProps {
  dayData: DayOperationalData;
  currentUser: UserAccount | null;
  onOpenDiagnosis: (groupId?: string) => void;
  onOpenWhatsApp: () => void;
  onExportExcel: () => void;
  onOpenAdmin: () => void;
  onReopenShift?: () => void;
  onOpenDrillDown?: () => void;
  onOpenNavigator?: () => void;
}

export function ShiftOverviewBanner({
  dayData,
  currentUser,
  onOpenDiagnosis,
  onOpenWhatsApp,
  onExportExcel,
  onOpenAdmin,
  onReopenShift,
  onOpenDrillDown,
  onOpenNavigator,
}: ShiftOverviewBannerProps) {
  const progress = getDayOverallProgress(dayData);
  const isSupervisor = currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';
  const [showReopenConfirm, setShowReopenConfirm] = React.useState(false);

  // Compute detailed multi-segment item telemetry across all groups for real-time donut arcs
  let totalItems = 0;
  let doneItems = 0;
  let skippedItems = 0;
  let pinnedItems = 0;
  let missedItems = 0;
  let incorrectItems = 0;

  for (const grp of dayData.groups || []) {
    for (const sub of grp.subGroups || []) {
      for (const chk of sub.checklists || []) {
        for (const item of chk.items || []) {
          totalItems++;
          if (item.status === 'done') doneItems++;
          else if (item.status === 'skipped') skippedItems++;
          else if (item.status === 'pinned') pinnedItems++;
          else if (item.status === 'missed') missedItems++;
          else if (item.status === 'incorrectly_executed') incorrectItems++;
        }
      }
    }
  }

  const exceptionsItems = skippedItems + pinnedItems;
  const issuesItems = missedItems + incorrectItems;
  const compliantPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const overallPercent = progress.percent;

  // Real-time Fleet Donut SVG Parameters
  const size = 96;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDone = totalItems > 0 ? (doneItems / totalItems) * circumference : 0;
  const strokeExceptions = totalItems > 0 ? (exceptionsItems / totalItems) * circumference : 0;
  const strokeIssues = totalItems > 0 ? (issuesItems / totalItems) * circumference : 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs text-slate-900 transition-all duration-300 hover:shadow-sm hover:border-slate-300">
      {/* Top Banner: Shift State & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>SHIFT DATE: {dayData.date}</span>
            </span>

            {dayData.isShiftClosed ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  onClick={() => { if (isSupervisor) onOpenDrillDown?.(); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wide ${isSupervisor ? 'cursor-pointer hover:bg-emerald-100' : ''}`}
                  title={isSupervisor ? 'Click to open Supervisor Drill-Down Dashboard' : undefined}
                >
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
              <span 
                onClick={() => { if (isSupervisor) onOpenDrillDown?.(); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wide ${isSupervisor ? 'cursor-pointer hover:bg-amber-100' : ''}`}
                title={isSupervisor ? 'Click to open Supervisor Drill-Down Dashboard' : undefined}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                Shift In-Progress
              </span>
            )}

            {dayData.closedBy && (
              <span className="text-xs text-slate-500">
                Closed by: <strong className="text-slate-700 font-semibold">{dayData.closedBy}</strong>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              REAL-TIME SYNCED
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              DEL Ground Ops Turnaround Checklists Control
            </h2>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {onOpenNavigator && (
            <button
              id="btn-banner-navigate-checklists"
              onClick={onOpenNavigator}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer border border-blue-400/40"
              title="Open Screen-Covering Operational Groups & Checklists Navigator"
            >
              <ListChecks className="w-4 h-4 text-sky-200 animate-pulse" />
              <span>Navigate to Checklists</span>
            </button>
          )}

          {isSupervisor && (
            <button
              id="btn-open-diagnosis"
              onClick={() => onOpenDiagnosis()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Close Shift"
            >
              <Stethoscope className="w-4 h-4 text-amber-600" />
              <span>Close Shift</span>
            </button>
          )}

          <button
            id="btn-open-whatsapp"
            onClick={onOpenWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Generate WhatsApp Broadcast"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp Summary</span>
          </button>

          <button
            id="btn-export-excel-log"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Download Excel Shift Audit"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Export</span>
          </button>

          {isAdmin && (
            <button
              id="btn-open-admin-panel"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-purple-600/20 cursor-pointer"
              title="Admin Templates & User Management"
            >
              <Sliders className="w-4 h-4" />
              <span>Admin Management</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Telemetry & Real-Time Status Donut Charts Section - Always Displayed */}
      <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Real-Time Fleet Status Donut Arc Card (Col 1-4) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-4 shadow-3xs">
          {/* SVG Donut Chart */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#F1F5F9"
                strokeWidth={strokeWidth}
              />
              {dayData.isShiftClosed ? (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              ) : (
                <>
                  {/* Compliant Checks Segment (Emerald) */}
                  {strokeDone > 0 && (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeDone} ${circumference}`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  )}
                  {/* Exceptions Segment - Skipped & Pinned (Amber) */}
                  {strokeExceptions > 0 && (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeExceptions} ${circumference}`}
                      strokeDashoffset={-strokeDone}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  )}
                  {/* Non-compliance Issues - Missed / Incorrect (Rose) */}
                  {strokeIssues > 0 && (
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${strokeIssues} ${circumference}`}
                      strokeDashoffset={-(strokeDone + strokeExceptions)}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  )}
                </>
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-slate-900 leading-none font-mono">
                {overallPercent}%
              </span>
              <span className="text-[9px] font-extrabold text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                COMPLIANCE
              </span>
            </div>
          </div>

          {/* Donut Legend & Real-Time Item Counts */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 font-mono uppercase tracking-wide">
                Live Fleet Status
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                {doneItems + exceptionsItems}/{totalItems}
              </span>
            </div>

            <div className="space-y-1 text-[11px] font-medium">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>Compliant Done</span>
                </span>
                <span className="font-mono font-bold text-emerald-700">{doneItems}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <span>Exceptions / Pinned</span>
                </span>
                <span className="font-mono font-bold text-amber-700">{exceptionsItems}</span>
              </div>
              {issuesItems > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-rose-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span>Issues / Missed</span>
                  </span>
                  <span className="font-mono font-black text-rose-700">{issuesItems}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
                    <span>Pending Checks</span>
                  </span>
                  <span className="font-mono font-bold text-slate-500">
                    {Math.max(0, totalItems - doneItems - exceptionsItems)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 Telemetry Summary Cards (Col 5-12) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Operational Groups Status */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-2xl p-3.5 space-y-2 hover:bg-white hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 font-mono tracking-wider">
              <span className="uppercase">Completed Groups</span>
              <div className="p-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-3xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">{progress.completedGroups}</span>
              <span className="text-xs text-slate-500 font-medium">/ {progress.totalGroups} active</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {progress.completedGroups === progress.totalGroups ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">❇️ All groups complete</span>
              ) : (
                <span className="text-slate-600 font-medium">⏳ {progress.totalGroups - progress.completedGroups} groups pending</span>
              )}
            </p>
          </div>

          {/* Supervisor Verified Groups */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-2xl p-3.5 space-y-2 hover:bg-white hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 font-mono tracking-wider">
              <span className="uppercase">Supervisor Locked</span>
              <div className="p-1 rounded bg-sky-50 text-sky-600 border border-sky-100 shadow-3xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">{progress.verifiedGroups}</span>
              <span className="text-xs text-slate-500 font-medium">/ {progress.totalGroups} verified</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {progress.verifiedGroups === progress.totalGroups ? (
                <span className="text-sky-700 font-semibold flex items-center gap-1">🛡️ Full shift verified</span>
              ) : (
                <span className="text-amber-700 font-medium">🔑 Pending supervisor sign-off</span>
              )}
            </p>
          </div>

          {/* Exceptions & Skips */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-2xl p-3.5 space-y-2 hover:bg-white hover:shadow-xs transition-all duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 font-mono tracking-wider">
              <span className="uppercase">Item Exceptions</span>
              <div className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-100 shadow-3xs">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                {progress.skippedItems + progress.pinnedItems}
              </span>
              <span className="text-xs text-slate-500 font-medium">exceptions</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span>Skipped: <strong className="text-slate-700 font-bold">{progress.skippedItems}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Pinned: <strong className="text-amber-700 font-extrabold">{progress.pinnedItems}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

