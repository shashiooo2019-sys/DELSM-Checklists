'use client';

import React, { useState, useEffect } from 'react';
import { UserAccount, DayOperationalData } from '@/types/aviation';
import { getDayOverallProgress, getDefaultDateString, formatDateToYYYYMMDD } from '@/lib/storage';
import { 
  Plane, 
  Clock, 
  Calendar, 
  User, 
  Shield, 
  LogOut, 
  LogIn, 
  KeyRound, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserAccount | null;
  selectedDate: string;
  onDateChange: (newDate: string) => void;
  onOpenLogin: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  dayData: DayOperationalData;
  onOpenWhatsApp: () => void;
  onExportExcel: () => void;
}

export function Header({
  currentUser,
  selectedDate,
  onDateChange,
  onOpenLogin,
  onOpenChangePassword,
  onLogout,
  dayData,
  onOpenWhatsApp,
  onExportExcel,
}: HeaderProps) {
  const [utcTime, setUtcTime] = useState<string>('');
  const [localTime, setLocalTime] = useState<string>('');
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toLocaleTimeString([], { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC');
      setLocalTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const parseSelectedDate = (str: string): Date => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const handlePrevDay = () => {
    const d = parseSelectedDate(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(formatDateToYYYYMMDD(d));
  };

  const handleNextDay = () => {
    const d = parseSelectedDate(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(formatDateToYYYYMMDD(d));
  };

  const handleToday = () => {
    onDateChange(getDefaultDateString());
  };

  const progress = getDayOverallProgress(dayData);
  const defaultDateStr = getDefaultDateString();
  const isDefaultDate = defaultDateStr === selectedDate;

  // Clearance status state machine
  const nowObj = new Date();
  const activeHour = simulatedHour !== null ? simulatedHour : nowObj.getHours();
  const activeMinute = simulatedHour !== null ? 0 : nowObj.getMinutes();
  const minutesOfDay = activeHour * 60 + activeMinute;

  // Determine Today and Tomorrow dates
  const formatYMD = (d: Date) => {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const todayStr = formatYMD(nowObj);
  const tomorrowObj = new Date(nowObj);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = formatYMD(tomorrowObj);

  const isTimeRange = activeHour >= 17 && activeHour <= 23;
  const showAdditionalInfo = isTimeRange && (selectedDate === tomorrowStr);

  const groupsList = dayData?.groups || [];

  const isDayShiftGroup = (grp: any) => {
    const name = (grp.name || '').toLowerCase();
    const code = (grp.code || '').toLowerCase();
    const id = (grp.id || '').toLowerCase();
    return name.includes('day shift') || code.includes('day-ops') || id.includes('day-shift');
  };

  const isGroupCompleteAndVerified = (grp: any) => {
    const isComplete = !grp.subGroups || grp.subGroups.length === 0 || grp.subGroups.every((sub: any) => {
      return !sub.checklists || sub.checklists.length === 0 || sub.checklists.every((chk: any) => chk.status === 'completed');
    });
    return isComplete && grp.isVerified;
  };

  const dayShiftGroups = groupsList.filter(grp => isDayShiftGroup(grp));
  const nonDayShiftGroups = groupsList.filter(grp => !isDayShiftGroup(grp));

  const allButDayShiftVerified = nonDayShiftGroups.length > 0
    ? nonDayShiftGroups.every(grp => isGroupCompleteAndVerified(grp))
    : false;

  const dayShiftVerified = dayShiftGroups.length > 0
    ? dayShiftGroups.every(grp => isGroupCompleteAndVerified(grp))
    : true;

  let clearanceText = '';
  let clearanceColor = 'text-emerald-600 font-bold';

  const isNightShiftHours = minutesOfDay >= 1020 || minutesOfDay < 210; // 17:00 to 03:30

  if (isNightShiftHours) {
    if (!dayShiftVerified) {
      clearanceText = "Day shift Clearance Pending, Night Shift on";
      clearanceColor = "text-amber-600 font-bold";
    } else {
      clearanceText = "Night Shift On";
      clearanceColor = "text-indigo-600 font-bold";
    }
  } else if (minutesOfDay >= 210 && minutesOfDay < 570) { // 03:30 to 09:30
    if (allButDayShiftVerified) {
      clearanceText = "Night Shift Cleared";
      clearanceColor = "text-emerald-600 font-bold";
    } else {
      clearanceText = "Night Shift Clearance Pending";
      clearanceColor = "text-amber-600 font-bold";
    }
  } else { // 09:30 to 17:00
    if (allButDayShiftVerified) {
      clearanceText = "Day Shift On";
      clearanceColor = "text-blue-600 font-bold";
    } else {
      clearanceText = "Day Shift On (Night Shift Verification Pending)";
      clearanceColor = "text-amber-600 font-bold";
    }
  }

  const cycleSimulation = () => {
    if (simulatedHour === null) {
      setSimulatedHour(1); // Night Shift (01:00)
    } else if (simulatedHour === 1) {
      setSimulatedHour(5); // Early Morning (05:00)
    } else if (simulatedHour === 5) {
      setSimulatedHour(12); // Midday (12:00)
    } else if (simulatedHour === 12) {
      setSimulatedHour(18); // Evening (18:00)
    } else {
      setSimulatedHour(null); // Real Time
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-30 shadow-2xs">
      {/* Top Banner with Station Telemetry & Time */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-1.5 border-b border-slate-100 text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              STATION: DEL
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[11px] select-none cursor-pointer hover:bg-slate-50 px-1.5 py-0.5 rounded transition" onClick={cycleSimulation} title="Click to cycle simulated shift times and verify Clearance Status states">
              CLEARANCE STATUS: <span className={`${clearanceColor} tracking-tight`}>{clearanceText}</span>
              {simulatedHour !== null && (
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.25 rounded font-bold animate-pulse ml-1">
                  SIM: {String(simulatedHour).padStart(2, '0')}:00
                </span>
              )}
            </span>
            {showAdditionalInfo && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md shadow-3xs animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span>Current Date: <strong className="font-semibold">{todayStr}</strong></span>
                <span className="text-amber-300">|</span>
                <span>Flight Date: <strong className="font-semibold">{selectedDate} (Tomorrow)</strong></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{utcTime || '00:00 UTC'}</span>
            </div>
            <div className="hidden sm:inline-block text-slate-300">|</div>
            <div className="text-slate-500">
              LOC: <span className="text-slate-800 font-semibold">{localTime || '00:00:00'}</span>
            </div>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="flex items-center justify-between py-3 flex-wrap gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Plane className="w-5 h-5 transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  DEL<span className="text-blue-600">GROUND OPS</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Turnaround Control v2.4
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Turnaround Checklists Control</p>
            </div>
          </div>

          {/* Date Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              id="btn-prev-day"
              onClick={handlePrevDay}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition shadow-2xs"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <input
                id="ops-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              id="btn-next-day"
              onClick={handleNextDay}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition shadow-2xs"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isDefaultDate && (
              <button
                id="btn-jump-today"
                onClick={handleToday}
                className="ml-1 text-[11px] font-bold px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition shadow-2xs"
                title={`Reset to Default Operational Shift Date (${defaultDateStr})`}
              >
                Current Shift
              </button>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col text-right cursor-pointer" onClick={onOpenLogin} title="Click to Switch Role or Change Login">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1.5">
                    <span>{currentUser.name}</span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                        currentUser.role === 'ADMIN'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : currentUser.role === 'SUPERVISOR'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{currentUser.uNumber}</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    id="btn-switch-role"
                    onClick={onOpenLogin}
                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition text-xs font-bold flex items-center gap-1"
                    title="Switch Sign-In Role or Change Login"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Switch Role</span>
                  </button>
                  <button
                    id="btn-logout"
                    onClick={onLogout}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="btn-login-header"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Select Role</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
