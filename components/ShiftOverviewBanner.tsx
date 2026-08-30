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
  ListChecks,
  ChevronDown,
  ChevronUp
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

function Silver3DCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({
      x: Number(((y / rect.height) * -6).toFixed(2)),
      y: Number(((x / rect.width) * 6).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${
          isHovered ? '-6px' : '0px'
        })`,
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
      }}
      className={`relative rounded-2xl sm:rounded-3xl border-2 border-slate-300/90 hover:border-slate-400 bg-gradient-to-br from-slate-100 via-white to-slate-200/90 shadow-[0_6px_0_0_rgba(203,213,225,0.95),0_10px_20px_-3px_rgba(15,23,42,0.12)] hover:shadow-[0_14px_0_0_rgba(148,163,184,0.95),0_20px_30px_-4px_rgba(15,23,42,0.18)] transition-all duration-300 transform-gpu overflow-hidden ${className}`}
    >
      {/* Glossy Top Sheen Overlay */}
      <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-t from-transparent via-white/20 to-white/60 pointer-events-none z-0" />
      <div className="relative z-10 p-4 sm:p-5 md:p-6 flex flex-col justify-between h-full w-full">{children}</div>
    </div>
  );
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
  const [isExpanded, setIsExpanded] = React.useState(false);

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
  const size = 112;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDone = totalItems > 0 ? (doneItems / totalItems) * circumference : 0;
  const strokeExceptions = totalItems > 0 ? (exceptionsItems / totalItems) * circumference : 0;
  const strokeIssues = totalItems > 0 ? (issuesItems / totalItems) * circumference : 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-xs text-slate-900 transition-all duration-300 hover:shadow-sm hover:border-slate-300">
      {/* Top Banner: Shift State & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-slate-100">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs sm:text-sm font-mono font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>SHIFT DATE: {dayData.date}</span>
            </span>

            {dayData.isShiftClosed ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  onClick={() => { if (isSupervisor) onOpenDrillDown?.(); }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs sm:text-sm font-bold uppercase tracking-wide ${isSupervisor ? 'cursor-pointer hover:bg-emerald-100' : ''}`}
                  title={isSupervisor ? 'Click to open Supervisor Drill-Down Dashboard' : undefined}
                >
                  <Lock className="w-4 h-4 text-emerald-600" />
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
                    className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs sm:text-sm font-bold uppercase tracking-wide ${isSupervisor ? 'cursor-pointer hover:bg-amber-100' : ''}`}
                title={isSupervisor ? 'Click to open Supervisor Drill-Down Dashboard' : undefined}
              >
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                Shift In-Progress
              </span>
            )}

            {dayData.closedBy && (
              <span className="text-xs sm:text-sm text-slate-500">
                Closed by: <strong className="text-slate-700 font-semibold">{dayData.closedBy}</strong>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] sm:text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              REAL-TIME SYNCED
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-0.5">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              DEL Ground Ops Turnaround Checklists Control
            </h2>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
          {onOpenNavigator && (
            <button
              id="btn-banner-navigate-checklists"
              onClick={onOpenNavigator}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl text-xs sm:text-sm md:text-base font-black transition-all shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer border border-blue-400/40"
              title="Open Screen-Covering Operational Groups & Checklists Navigator"
            >
              <ListChecks className="w-4.5 h-4.5 text-sky-200 animate-pulse" />
              <span>Navigate to Checklists</span>
            </button>
          )}

          {isSupervisor && (
            <button
              id="btn-open-diagnosis"
              onClick={() => onOpenDiagnosis()}
              className="btn-3d-amber flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
              title="Close Shift"
            >
              <Stethoscope className="w-4 h-4 text-amber-100" />
              <span>Close Shift</span>
            </button>
          )}

          <button
            id="btn-open-whatsapp"
            onClick={onOpenWhatsApp}
            className="btn-3d-emerald flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
            title="Generate WhatsApp Broadcast"
          >
            <Share2 className="w-4 h-4 text-emerald-100" />
            <span>WhatsApp Summary</span>
          </button>

          <button
            id="btn-export-excel-log"
            onClick={onExportExcel}
            className="btn-3d-white flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
            title="Download Excel Shift Audit"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Export</span>
          </button>

          {isAdmin && (
            <button
              id="btn-open-admin-panel"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm shadow-purple-600/20 cursor-pointer"
              title="Admin Templates & User Management"
            >
              <Sliders className="w-4 h-4" />
              <span>Admin Management</span>
            </button>
          )}

          {/* Toggle Expand/Collapse Button */}
          <button
            id="btn-toggle-shift-overview"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-3d-blue flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer text-white"
            title={isExpanded ? 'Collapse Overview Telemetry' : 'Expand Overview Telemetry'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-blue-100 shrink-0" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-blue-100 shrink-0" />
                <span>Expand Overview</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Telemetry & Real-Time Status Donut Charts Section - Displayed when Expanded */}
      {isExpanded && (
        <div className="pt-4 sm:pt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 animate-in fade-in duration-200">
        {/* Main Real-Time Fleet Status Donut Arc Card (Col 1-4) */}
        <Silver3DCard className="lg:col-span-4 flex flex-row items-center gap-4 sm:gap-6">
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
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none font-mono">
                {overallPercent}%
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 font-mono mt-1 uppercase tracking-wider">
                COMPLIANCE
              </span>
            </div>
          </div>

          {/* Donut Legend & Real-Time Item Counts */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
              <span className="text-xs sm:text-sm font-black text-slate-900 font-mono uppercase tracking-wide">
                Live Fleet Status
              </span>
              <span className="text-xs sm:text-sm font-mono font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                {doneItems + exceptionsItems}/{totalItems}
              </span>
            </div>

            <div className="space-y-1.5 text-xs sm:text-sm font-medium">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>Compliant Done</span>
                </span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm sm:text-base">{doneItems}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>Exceptions / Pinned</span>
                </span>
                <span className="font-mono font-extrabold text-amber-700 text-sm sm:text-base">{exceptionsItems}</span>
              </div>
              {issuesItems > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-rose-700 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                    <span>Issues / Missed</span>
                  </span>
                  <span className="font-mono font-black text-rose-700 text-sm sm:text-base">{issuesItems}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-500 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0"></span>
                    <span>Pending Checks</span>
                  </span>
                  <span className="font-mono font-extrabold text-slate-600 text-sm sm:text-base">
                    {Math.max(0, totalItems - doneItems - exceptionsItems)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Silver3DCard>

        {/* 3 Telemetry Summary Cards (Col 5-12) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5 lg:gap-4">
          {/* Operational Groups Status */}
          <Silver3DCard className="flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-black text-slate-600 font-mono tracking-wider">
              <span className="uppercase">Completed Groups</span>
              <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-700 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 font-mono tracking-tight">{progress.completedGroups}</span>
              <span className="text-sm sm:text-base lg:text-lg text-slate-500 font-extrabold">/ {progress.totalGroups} active</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold pt-1 border-t border-slate-200/60">
              {progress.completedGroups === progress.totalGroups ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">❇️ All groups complete</span>
              ) : (
                <span className="text-slate-700 font-semibold">⏳ {progress.totalGroups - progress.completedGroups} groups pending</span>
              )}
            </p>
          </Silver3DCard>

          {/* Supervisor Verified Groups */}
          <Silver3DCard className="flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-black text-slate-600 font-mono tracking-wider">
              <span className="uppercase">Supervisor Locked</span>
              <div className="p-1.5 rounded-xl bg-sky-100/80 text-sky-700 border border-sky-200 shadow-2xs">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 font-mono tracking-tight">{progress.verifiedGroups}</span>
              <span className="text-sm sm:text-base lg:text-lg text-slate-500 font-extrabold">/ {progress.totalGroups} verified</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-semibold pt-1 border-t border-slate-200/60">
              {progress.verifiedGroups === progress.totalGroups ? (
                <span className="text-sky-700 font-bold flex items-center gap-1">🛡️ Full shift verified</span>
              ) : (
                <span className="text-amber-800 font-bold">🔑 Pending supervisor sign-off</span>
              )}
            </p>
          </Silver3DCard>

          {/* Exceptions & Skips */}
          <Silver3DCard className="flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-black text-slate-600 font-mono tracking-wider">
              <span className="uppercase">Item Exceptions</span>
              <div className="p-1.5 rounded-xl bg-amber-100/80 text-amber-700 border border-amber-200 shadow-2xs">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 font-mono tracking-tight">
                {progress.skippedItems + progress.pinnedItems}
              </span>
              <span className="text-sm sm:text-base lg:text-lg text-slate-500 font-extrabold">exceptions</span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 font-mono pt-1 border-t border-slate-200/60">
              <span>Skipped: <strong className="text-slate-800 font-black">{progress.skippedItems}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Pinned: <strong className="text-amber-800 font-black">{progress.pinnedItems}</strong></span>
            </div>
          </Silver3DCard>
        </div>
      </div>
      )}
    </div>
  );
}

