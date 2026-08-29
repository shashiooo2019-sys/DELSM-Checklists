'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { 
  UserAccount, 
  DayOperationalData, 
  OperationalGroup, 
  SubOperationalGroup, 
  Checklist,
  UserRole
} from '@/types/aviation';
import { 
  getActiveSession, 
  setActiveSession, 
  subscribeSession,
  getSessionSnapshot,
  getSessionServerSnapshot,
  getTodayDateString, 
  loadDayData, 
  saveDayData, 
  addAuditLog, 
  exportShiftToExcel,
  isGroupComplete,
  authenticateUserAsync,
  ensureDateWindowInitialized,
  purgeOldShiftsAndAuditLogs,
  purgeLocalStaleData,
} from '@/lib/storage';
import { createInitialDayData } from '@/lib/initialData';
import { loadDayDataFromFirestore, subscribeToDayData } from '@/lib/firestoreService';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Header } from '@/components/Header';
import { LoginModal } from '@/components/LoginModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { ShiftOverviewBanner } from '@/components/ShiftOverviewBanner';
import { GroupCard } from '@/components/GroupCard';
import { ChecklistCarouselModal } from '@/components/ChecklistCarouselModal';
import { SupervisorDiagnosisModal } from '@/components/SupervisorDiagnosisModal';
import { ChecklistDrillDownView } from '@/components/ChecklistDrillDownView';
import { WhatsAppShareModal } from '@/components/WhatsAppShareModal';
import { AdminPanel } from '@/components/AdminPanel';
import { AuditLogDrawer } from '@/components/AuditLogDrawer';
import { ConfirmModal, ConfirmModalState } from '@/components/ConfirmModal';
import { ChecklistSearchModal } from '@/components/ChecklistSearchModal';
import { 
  Plane, 
  Building2, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  History, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  LogIn,
  AlertCircle,
  Lock,
  User,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Menu,
  X,
  Sparkles
} from 'lucide-react';

export default function AviationGroundOpsPage() {
  const currentUser = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [dayData, setDayData] = useState<DayOperationalData>(() => createInitialDayData(getTodayDateString()));

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [isMandatoryFirstLogin, setIsMandatoryFirstLogin] = useState<boolean>(false);

  // Page-level login form state
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginRole, setLoginRole] = useState<UserRole>('USER');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState<boolean>(false);

  const handlePageLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanInput = loginUsername.trim();
    if (!cleanInput) {
      setLoginError('Please enter your Username or U-Number.');
      return;
    }

    const cleanPassword = loginPassword.trim();
    if (!cleanPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsLoginLoading(true);
    try {
      const result = await authenticateUserAsync(cleanInput, cleanPassword, loginRole);
      setIsLoginLoading(false);
      if (!result.success || !result.user) {
        setLoginError(result.error || 'Authentication failed. Please verify your credentials.');
        return;
      }
      handleLoginSuccess(result.user, result.mustChangePassword || false);
    } catch (err: any) {
      setLoginError('Authentication error. Please try again.');
      setIsLoginLoading(false);
    }
  };
  
  // Checklist Execution state
  const [activeChecklistModal, setActiveChecklistModal] = useState<{
    isOpen: boolean;
    group: OperationalGroup | null;
    subGroup: SubOperationalGroup | null;
    checklist: Checklist | null;
  }>({
    isOpen: false,
    group: null,
    subGroup: null,
    checklist: null,
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Supervisor Diagnosis state
  const [diagnosisModalState, setDiagnosisModalState] = useState<{
    isOpen: boolean;
    targetGroupId?: string;
  }>({
    isOpen: false,
  });

  // Day Shift separate Supervisor & WhatsApp states
  const [dayShiftDiagnosisState, setDayShiftDiagnosisState] = useState<{
    isOpen: boolean;
    targetGroupId?: string;
  }>({ isOpen: false });
  const [isDayShiftWhatsAppOpen, setIsDayShiftWhatsAppOpen] = useState<boolean>(false);

  // WhatsApp & Admin & Audit & Checklist Search states
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState<boolean>(false);
  const [isChecklistSearchOpen, setIsChecklistSearchOpen] = useState<boolean>(false);
  const [reopenDrillDownAfterChecklistClose, setReopenDrillDownAfterChecklistClose] = useState<boolean>(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState<boolean>(false);

  // Group Filters
  const [filterCategory, setFilterCategory] = useState<'all' | 'flights' | 'terminal' | 'pending' | 'completed' | 'non-compliance'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileFilterMenuOpen, setIsMobileFilterMenuOpen] = useState<boolean>(false);
  const [isFilterOverflowOpen, setIsFilterOverflowOpen] = useState<boolean>(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [groupExpansion, setGroupExpansion] = useState<Record<string, boolean>>({});

  // Real-time Firestore & Local Day Data Sync
  useEffect(() => {
    // Sync local day data asynchronously to avoid cascading synchronous render
    Promise.resolve().then(() => {
      const local = loadDayData(selectedDate);
      if (local && local.groups && local.groups.length > 0) {
        setDayData((prev) => (prev.date === selectedDate ? local : prev));
      }
    });

    // Initial fetch from Firestore for selectedDate
    loadDayDataFromFirestore(selectedDate).then((remoteData) => {
      if (remoteData && remoteData.groups && remoteData.groups.length > 0) {
        setDayData(remoteData);
      }
    });

    // Real-time listener for shift doc
    const unsubscribe = subscribeToDayData(selectedDate, (remoteData) => {
      if (remoteData && remoteData.groups && remoteData.groups.length > 0) {
        setDayData(remoteData);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedDate]);

  // Rolling 10-Day Window Generator & 1-Month Purge Policy Lifecycle
  useEffect(() => {
    // 1. Expand and initialize the rolling 10-day forward window in background
    ensureDateWindowInitialized(10);

    // 2. Execute 1-month retention maintenance (purging shifts & audit logs older than 30 days)
    purgeOldShiftsAndAuditLogs(30);
    purgeLocalStaleData(30);

    // Periodically re-check the rolling window as time progresses (e.g. every hour)
    const windowInterval = setInterval(() => {
      ensureDateWindowInitialized(10);
      purgeOldShiftsAndAuditLogs(30);
      purgeLocalStaleData(30);
    }, 60 * 60 * 1000);

    return () => clearInterval(windowInterval);
  }, []);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const loaded = loadDayData(newDate);
    setDayData(loaded);
  };

  // Auth Handlers
  const handleLoginSuccess = (user: UserAccount, mustChange: boolean) => {
    setActiveSession(user);
    setIsLoginModalOpen(false);

    addAuditLog(user.uNumber, user.name, user.role, 'USER_LOGIN', `User signed into terminal.`, selectedDate);

    // Bypass mandatory password change flow per user request
    if (mustChange) {
      // We still update local state if needed but we no longer force the modal
      setIsMandatoryFirstLogin(false);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      addAuditLog(currentUser.uNumber, currentUser.name, currentUser.role, 'USER_LOGOUT', `User logged out.`, selectedDate);
    }
    try {
      signOut(auth);
    } catch {}
    setActiveSession(null);
  };

  const handlePasswordChangeSuccess = () => {
    setIsMandatoryFirstLogin(false);
    setIsChangePasswordModalOpen(false);
    const updated = getActiveSession();
    if (updated) setActiveSession(updated);
  };

  // Checklist Save Handler
  const handleSaveChecklist = (updatedChecklist: Checklist) => {
    if (!activeChecklistModal.group || !activeChecklistModal.subGroup) return;

    const targetGroupId = activeChecklistModal.group.id;
    const targetSubGroupId = activeChecklistModal.subGroup.id;

    const updatedGroups = dayData.groups.map((grp) => {
      if (grp.id === targetGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === targetSubGroupId) {
              return {
                ...sub,
                checklists: sub.checklists.map((chk) => {
                  if (chk.id === updatedChecklist.id) {
                    return updatedChecklist;
                  }
                  return chk;
                }),
              };
            }
            return sub;
          }),
        };
      }
      return grp;
    });

    const newDayData: DayOperationalData = {
      ...dayData,
      groups: updatedGroups,
    };

    saveDayData(newDayData);
    setDayData(newDayData);

    if (currentUser) {
      addAuditLog(
        currentUser.uNumber,
        currentUser.name,
        currentUser.role,
        'CHECKLIST_SUBMIT',
        `Executed checklist "${updatedChecklist.title}" in ${activeChecklistModal.group.name}. Status: ${updatedChecklist.status.toUpperCase()}`,
        selectedDate
      );
    }
  };

  // Single-Click Checklist Reset Handler
  const handleResetChecklist = (
    group: OperationalGroup,
    subGroup: SubOperationalGroup,
    checklist: Checklist
  ) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Checklist',
      message: `Are you sure you want to reset all ${checklist.items.length} items in "${checklist.title}" back to NOT DONE?\n\nThis will clear all completion statuses and timestamps for this checklist.`,
      confirmLabel: 'Reset Checklist',
      variant: 'warning',
      onConfirm: () => {
        const resetChecklistObj: Checklist = {
          ...checklist,
          status: 'pending',
          completedBy: undefined,
          completedAt: undefined,
          remarks: undefined,
          items: checklist.items.map((item) => ({
            ...item,
            status: 'not_done',
            actionBy: undefined,
            actionAt: undefined,
            skipReason: undefined,
          })),
        };

        const updatedGroups = dayData.groups.map((grp) => {
          if (grp.id === group.id) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.id === subGroup.id) {
                  return {
                    ...sub,
                    checklists: sub.checklists.map((chk) => {
                      if (chk.id === checklist.id) {
                        return resetChecklistObj;
                      }
                      return chk;
                    }),
                  };
                }
                return sub;
              }),
            };
          }
          return grp;
        });

        const newDayData: DayOperationalData = {
          ...dayData,
          groups: updatedGroups,
        };

        saveDayData(newDayData);
        setDayData(newDayData);

        if (currentUser) {
          addAuditLog(
            currentUser.uNumber,
            currentUser.name,
            currentUser.role,
            'CHECKLIST_RESET',
            `Reset checklist "${checklist.title}" in ${group.name}. All items marked as NOT DONE.`,
            selectedDate
          );
        }
      },
    });
  };

  // Admin Checklist Deletion Handler
  const handleDeleteChecklistInGroupCard = (
    group: OperationalGroup,
    subGroup: SubOperationalGroup,
    checklist: Checklist
  ) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Checklist',
      message: `[ADMIN ACTION] Are you sure you want to delete the checklist "${checklist.title}" from group "${group.name}"?\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete Checklist',
      variant: 'danger',
      onConfirm: () => {
        const updatedGroups = dayData.groups.map((grp) => {
          if (grp.id === group.id) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.id === subGroup.id || sub.checklists.some((c) => c.id === checklist.id)) {
                  return {
                    ...sub,
                    checklists: sub.checklists.filter(
                      (c) =>
                        c.id !== checklist.id &&
                        c.title.trim().toLowerCase() !== checklist.title.trim().toLowerCase()
                    ),
                  };
                }
                return sub;
              }),
            };
          }
          return grp;
        });

        const newDayData: DayOperationalData = {
          ...dayData,
          groups: updatedGroups,
        };

        saveDayData(newDayData);
        setDayData(newDayData);

        if (currentUser) {
          addAuditLog(
            currentUser.uNumber,
            currentUser.name,
            currentUser.role,
            'ADMIN_DELETE',
            `Deleted checklist "${checklist.title}" from ${group.name}`,
            selectedDate
          );
        }
      },
    });
  };

  // Supervisor Group Verification Handler
  const handleVerifyGroup = (groupId: string, notes?: string) => {
    if (!currentUser) return;

    const updatedGroups = dayData.groups.map((grp) => {
      if (grp.id === groupId) {
        return {
          ...grp,
          isVerified: true,
          verifiedBy: `${currentUser.name} (${currentUser.uNumber})`,
          verifiedAt: new Date().toISOString(),
          supervisorNotes: notes || grp.supervisorNotes,
        };
      }
      return grp;
    });

    const newDayData: DayOperationalData = {
      ...dayData,
      groups: updatedGroups,
    };

    saveDayData(newDayData);
    setDayData(newDayData);

    const targetGroup = dayData.groups.find((g) => g.id === groupId);
    const isDayShift = targetGroup ? (targetGroup.name.includes('Day Shift') || targetGroup.code === 'DAY-OPS') : false;
    addAuditLog(
      currentUser.uNumber,
      currentUser.name,
      currentUser.role,
      isDayShift ? 'DAY_SHIFT_VERIFY_CLOSE' : 'SUPERVISOR_VERIFY_GROUP',
      isDayShift
        ? `Closed and updated Day Shift Operations status to "Shift Verified and Closed". ${notes ? `Notes: ${notes}` : ''}`
        : `Authorized and locked Operational Group "${targetGroup?.name || groupId}". Notes: ${notes || 'None'}`,
      selectedDate
    );
  };

  const handleReopenGroup = (groupId: string) => {
    if (!currentUser) return;

    const updatedGroups = dayData.groups.map((grp) => {
      if (grp.id === groupId) {
        return {
          ...grp,
          isVerified: false,
          verifiedBy: undefined,
          verifiedAt: undefined,
        };
      }
      return grp;
    });

    const newDayData: DayOperationalData = {
      ...dayData,
      groups: updatedGroups,
    };

    saveDayData(newDayData);
    setDayData(newDayData);

    const targetGroup = dayData.groups.find((g) => g.id === groupId);
    const isDayShift = targetGroup ? (targetGroup.name.includes('Day Shift') || targetGroup.code === 'DAY-OPS') : false;
    addAuditLog(
      currentUser.uNumber,
      currentUser.name,
      currentUser.role,
      isDayShift ? 'DAY_SHIFT_REOPEN' : 'SUPERVISOR_REOPEN_GROUP',
      isDayShift
        ? `Reopened Day Shift Operations for ground rework and editing.`
        : `Reopened Operational Group "${targetGroup?.name || groupId}" for ground rework.`,
      selectedDate
    );
  };

  const handleReopenShift = () => {
    if (!currentUser) return;

    const newDayData: DayOperationalData = {
      ...dayData,
      isShiftClosed: false,
      closedBy: undefined,
      closedAt: undefined,
      shiftNotes: undefined,
    };

    saveDayData(newDayData);
    setDayData(newDayData);

    addAuditLog(
      currentUser.uNumber,
      currentUser.name,
      currentUser.role,
      'SHIFT_REOPEN',
      `Reopened operational shift for ${selectedDate}.`,
      selectedDate
    );
  };

  const handleCloseShift = (notes?: string, supervisorName?: string) => {
    if (!currentUser) return;

    const signature = supervisorName 
      ? (supervisorName.includes('(') ? supervisorName : `${supervisorName} (${currentUser.uNumber})`) 
      : `${currentUser.name} (${currentUser.uNumber})`;

    const updatedGroups = dayData.groups.map((grp) => {
      if (grp.name.includes('Day Shift') || grp.code === 'DAY-OPS') {
        return grp;
      }
      return {
        ...grp,
        isVerified: true,
        verifiedBy: signature,
        verifiedAt: new Date().toISOString(),
        supervisorNotes: grp.supervisorNotes || notes || 'Verified and locked upon shift closure.',
      };
    });

    const newDayData: DayOperationalData = {
      ...dayData,
      isShiftClosed: true,
      closedBy: signature,
      closedAt: new Date().toISOString(),
      shiftNotes: notes,
      groups: updatedGroups,
    };

    saveDayData(newDayData);
    setDayData(newDayData);

    addAuditLog(
      currentUser.uNumber,
      currentUser.name,
      currentUser.role,
      'SHIFT_CLOSURE',
      `Officially signed off and closed operational shift for ${selectedDate}. Notes: ${notes || 'None'}`,
      selectedDate
    );
  };

  const groupHasNonCompliance = (grp: OperationalGroup): boolean => {
    return grp.subGroups.some((sub) =>
      sub.checklists.some((chk) =>
        chk.items.some((item) => item.status === 'missed' || item.status === 'incorrectly_executed')
      )
    );
  };

  const nonComplianceGroupCount = dayData.groups.filter(groupHasNonCompliance).length;

  // Filter groups
  const filteredGroups = dayData.groups.filter((grp) => {
    // Search query filter
    const matchesSearch =
      grp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grp.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grp.subGroups.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const complete = isGroupComplete(grp);

    if (filterCategory === 'flights') return grp.isFlightGroup;
    if (filterCategory === 'terminal') return !grp.isFlightGroup;
    if (filterCategory === 'pending') return !complete;
    if (filterCategory === 'completed') return complete;
    if (filterCategory === 'non-compliance') return groupHasNonCompliance(grp);
    return true;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900">
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/20">
              <Plane className="w-5 h-5 transform -rotate-45" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">DEL Ground Ops</h2>
              <p className="text-xs text-slate-500">Aviation Turnaround & Ground Operations Checklist System</p>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-5">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePageLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Username / U-Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="input-page-login-username"
                    type="text"
                    placeholder="Enter Username or U-Number"
                    value={loginUsername}
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono placeholder:text-slate-400 transition"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-page-login-password"
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono placeholder:text-slate-400 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Sign-In Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole('USER');
                      if (loginError) setLoginError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      loginRole === 'USER'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole('SUPERVISOR');
                      if (loginError) setLoginError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      loginRole === 'SUPERVISOR'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>SUPERVISOR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole('ADMIN');
                      if (loginError) setLoginError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      loginRole === 'ADMIN'
                        ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                    <span>ADMIN</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                  🔒 <strong>Authorization Rules:</strong> Admin accounts can sign in as any role. Supervisor accounts can sign in as Supervisor or User. User accounts can only sign in as User.
                </p>
              </div>

              <button
                id="btn-page-login-submit"
                type="submit"
                disabled={isLoginLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer mt-2"
              >
                {isLoginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Roster ID & Role Permissions...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as {loginRole}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/65 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Aviation Top Header */}
      <Header
        currentUser={currentUser}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenChangePassword={() => {
          setIsMandatoryFirstLogin(false);
          setIsChangePasswordModalOpen(true);
        }}
        onLogout={handleLogout}
        dayData={dayData}
        onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
        onExportExcel={() => exportShiftToExcel(dayData)}
        onOpenDrillDown={() => setIsDrillDownOpen(true)}
        onOpenSearchChecklists={() => setIsChecklistSearchOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Banner for Logged Out User */}
        {!currentUser && (
          <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-md relative overflow-hidden group">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
                <Plane className="w-6.5 h-6.5 transform -rotate-45" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">DEL Ground Operations Command Center</h3>
                <p className="text-xs text-slate-300 font-medium max-w-2xl mt-0.5 leading-relaxed">
                  Select your assigned airport operation role (Admin, Supervisor, or Ground Crew) to execute checklists, log turnaround telemetry, and manage active flight operations.
                </p>
              </div>
            </div>

            <button
              id="btn-banner-login"
              onClick={() => setIsLoginModalOpen(true)}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all shrink-0 flex items-center gap-2 relative z-10"
            >
              <LogIn className="w-4 h-4" />
              <span>Authenticate Roster</span>
            </button>
          </div>
        )}

        {/* High-Level Telemetry Shift Banner */}
        <ShiftOverviewBanner
          dayData={dayData}
          currentUser={currentUser}
          onOpenDiagnosis={(groupId) => setDiagnosisModalState({ isOpen: true, targetGroupId: groupId })}
          onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
          onExportExcel={() => exportShiftToExcel(dayData)}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
          onReopenShift={handleReopenShift}
          onOpenDrillDown={() => setIsDrillDownOpen(true)}
        />

        {/* Operational Filter & Search Bar */}
        <div className="flex flex-col gap-3 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Quick Filter Tabs */}
            <div className="flex flex-row items-center gap-1.5 w-full lg:w-auto min-w-0 flex-1 overflow-hidden relative group">
              {/* Three-bars Menu Button to trigger Filter Pop-up Window */}
              <button
                id="btn-filter-modal-trigger"
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                title="Show all filter options in pop-up window"
                aria-label="Show all filter options in pop-up window"
              >
                <Menu className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider">Filters</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="sm:hidden flex items-center justify-between px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition hover:bg-slate-200 shrink-0 gap-2 border border-slate-200"
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="capitalize">{filterCategory}</span>
              </button>

              <div className="flex flex-row items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 pr-2 scroll-smooth max-w-full touch-pan-x flex-1">
                <button
                  id="filter-tab-all"
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 text-center ${
                    filterCategory === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  All Operations ({dayData.groups.length})
                </button>

                <button
                  id="filter-tab-flights"
                  type="button"
                  onClick={() => setFilterCategory('flights')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 ${
                    filterCategory === 'flights'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5 shrink-0" />
                  <span>Flight Turnarounds (4)</span>
                </button>

                <button
                  id="filter-tab-terminal"
                  type="button"
                  onClick={() => setFilterCategory('terminal')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 ${
                    filterCategory === 'terminal'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Terminal & Infrastructure</span>
                </button>

                <button
                  id="filter-tab-pending"
                  type="button"
                  onClick={() => setFilterCategory('pending')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 text-center ${
                    filterCategory === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  Pending Checks
                </button>

                <button
                  id="filter-tab-completed"
                  type="button"
                  onClick={() => setFilterCategory('completed')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 text-center ${
                    filterCategory === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  Completed
                </button>

                <button
                  id="filter-tab-non-compliance"
                  type="button"
                  onClick={() => setFilterCategory('non-compliance')}
                  className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 ${
                    filterCategory === 'non-compliance'
                      ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/80'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Non-Compliance ({nonComplianceGroupCount}) ❌</span>
                </button>
              </div>

              {/* Overflow Ellipsis Button */}
              <button
                id="filter-overflow-menu-btn"
                type="button"
                onClick={() => setIsFilterOverflowOpen(!isFilterOverflowOpen)}
                title="Expand all filter options in grid menu"
                aria-label="Expand all filter options in grid menu"
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center shrink-0 ${
                  isFilterOverflowOpen
                    ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                }`}
              >
                <MoreHorizontal className="w-4 h-4 shrink-0" />
              </button>

              {/* Subtle right-hand fade gradient overlay indicating scrollability */}
              <div className="pointer-events-none absolute right-10 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent hidden sm:block z-10" />
            </div>

            {/* Search Input, Checklist Finder & Audit Log Trigger */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                id="btn-open-checklist-search"
                type="button"
                onClick={() => setIsChecklistSearchOpen(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                title="Search all checklists and select flight turnaround"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Checklists</span>
              </button>

              <div className="relative flex-1 sm:w-56 min-w-[140px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  id="input-group-search"
                  type="text"
                  placeholder="Filter groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono transition"
                />
              </div>

              <button
                id="btn-open-audit-trail"
                onClick={() => setIsAuditLogOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer shrink-0"
                title="View Real-Time Audit Log"
              >
                <History className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid Layout Expansion when Overflow Menu Button (ellipsis) is clicked */}
          {isFilterOverflowOpen && (
            <div className="w-full pt-3 pb-1 px-1 border-t border-slate-200/80 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-slate-600" />
                  All Available Filter Categories
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Select to apply</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('all');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="truncate">All Operations</span>
                  <span className="text-[10px] font-mono opacity-80 shrink-0">({dayData.groups.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('flights');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'flights'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Plane className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Flight Turnarounds</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80 shrink-0">(4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('terminal');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'terminal'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Terminal Ops</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('pending');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'pending'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="truncate">Pending Checks</span>
                  <Clock className="w-3 h-3 opacity-70 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('completed');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'completed'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <span className="truncate">Completed</span>
                  <CheckCircle2 className="w-3 h-3 opacity-70 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory('non-compliance');
                    setIsFilterOverflowOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-between border text-left ${
                    filterCategory === 'non-compliance'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Non-Compliance</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0">
                    {nonComplianceGroupCount}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Operational Groups Hierarchical List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Operational Groups ({filteredGroups.length})
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-expand-all"
                type="button"
                onClick={() => {
                  const newMap: Record<string, boolean> = {};
                  filteredGroups.forEach((g) => {
                    newMap[g.id] = true;
                  });
                  setGroupExpansion(newMap);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>
              <button
                id="btn-collapse-all"
                type="button"
                onClick={() => {
                  const newMap: Record<string, boolean> = {};
                  filteredGroups.forEach((g) => {
                    newMap[g.id] = false;
                  });
                  setGroupExpansion(newMap);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No operational groups match your filter</h4>
              <p className="text-xs text-slate-500">
                Try selecting &ldquo;All Operations&rdquo; or adjusting your search query.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                currentUser={currentUser}
                isExpanded={groupExpansion[group.id] === true}
                onToggleExpand={() => {
                  setGroupExpansion((prev) => ({
                    ...prev,
                    [group.id]: prev[group.id] === true ? false : true,
                  }));
                }}
                onOpenChecklist={(grp, sub, chk) => {
                  setActiveChecklistModal({
                    isOpen: true,
                    group: grp,
                    subGroup: sub,
                    checklist: chk,
                  });
                }}
                onOpenDiagnosis={(groupId) => {
                  setDiagnosisModalState({
                    isOpen: true,
                    targetGroupId: groupId,
                  });
                }}
                onOpenDayShiftDiagnosis={(groupId) => {
                  setDayShiftDiagnosisState({
                    isOpen: true,
                    targetGroupId: groupId,
                  });
                }}
                onOpenDayShiftWhatsApp={() => setIsDayShiftWhatsAppOpen(true)}
                onResetChecklist={handleResetChecklist}
                onDeleteChecklist={handleDeleteChecklistInGroupCard}
                onReopenGroup={handleReopenGroup}
              />
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            AERO<span className="text-blue-600 font-semibold">OPS</span> · Aviation Turnaround & Ground Operations Checklist System · IATA AHM & Ground Safety Compliant
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            Shift: {selectedDate} · DEL Station
          </div>
        </div>
      </footer>

      {/* 1. Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 2. Change Password Modal (Mandatory on First Login or Manual) */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        user={currentUser}
        isMandatoryFirstLogin={isMandatoryFirstLogin}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={handlePasswordChangeSuccess}
      />

      {/* 3. Touch-Friendly Checklist Carousel & Execution Engine */}
      <ChecklistCarouselModal
        isOpen={activeChecklistModal.isOpen}
        checklist={activeChecklistModal.checklist}
        groupName={activeChecklistModal.group?.name || ''}
        subGroupName={activeChecklistModal.subGroup?.name || ''}
        currentUser={currentUser}
        onClose={() => {
          setActiveChecklistModal((prev) => ({ ...prev, isOpen: false }));
          if (reopenDrillDownAfterChecklistClose) {
            setIsDrillDownOpen(true);
            setReopenDrillDownAfterChecklistClose(false);
          }
        }}
        onSaveChecklist={handleSaveChecklist}
        isShiftClosed={dayData.isShiftClosed}
      />

      {/* 4. Supervisor Diagnosis & Verification Modal */}
      <SupervisorDiagnosisModal
        isOpen={diagnosisModalState.isOpen}
        dayData={dayData}
        currentUser={currentUser}
        targetGroupId={diagnosisModalState.targetGroupId}
        onClose={() => setDiagnosisModalState({ isOpen: false })}
        onVerifyGroup={handleVerifyGroup}
        onReopenGroup={handleReopenGroup}
        onCloseShift={handleCloseShift}
        onReopenShift={handleReopenShift}
      />

      {/* 4b. Day Shift Dedicated Supervisor Verification Modal */}
      <SupervisorDiagnosisModal
        isOpen={dayShiftDiagnosisState.isOpen}
        dayData={dayData}
        currentUser={currentUser}
        targetGroupId={dayShiftDiagnosisState.targetGroupId}
        dayShiftOnly={true}
        onClose={() => setDayShiftDiagnosisState({ isOpen: false })}
        onVerifyGroup={handleVerifyGroup}
        onReopenGroup={handleReopenGroup}
        onCloseShift={handleCloseShift}
        onReopenShift={handleReopenShift}
      />

      {/* 5. WhatsApp Broadcast Summary Modal */}
      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        dayData={dayData}
        currentUser={currentUser}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />

      {/* 5b. Day Shift Dedicated WhatsApp Summary Modal */}
      <WhatsAppShareModal
        isOpen={isDayShiftWhatsAppOpen}
        dayData={dayData}
        currentUser={currentUser}
        dayShiftOnly={true}
        onClose={() => setIsDayShiftWhatsAppOpen(false)}
      />

      {/* 6. Admin Management Control Center */}
      {currentUser?.role === 'ADMIN' && (
        <AdminPanel
          isOpen={isAdminPanelOpen}
          dayData={dayData}
          currentUser={currentUser}
          onClose={() => setIsAdminPanelOpen(false)}
          onSaveDayData={(updated) => {
            saveDayData(updated);
            setDayData(updated);
          }}
        />
      )}

      {/* 6b. Interactive Operational Drill-Down & Verification Cockpit */}
      {(currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN') && (
        <ChecklistDrillDownView
          isOpen={isDrillDownOpen}
          dayData={dayData}
          currentUser={currentUser}
          onClose={() => setIsDrillDownOpen(false)}
          onVerifyGroup={handleVerifyGroup}
          onReopenGroup={handleReopenGroup}
          onCloseShift={handleCloseShift}
          onReopenShift={handleReopenShift}
          onSaveDayData={(updated) => {
            saveDayData(updated);
            setDayData(updated);
          }}
          onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
          onOpenChecklist={(grp, sub, chk) => {
            setIsDrillDownOpen(false);
            setReopenDrillDownAfterChecklistClose(true);
            setActiveChecklistModal({
              isOpen: true,
              group: grp,
              subGroup: sub,
              checklist: chk,
            });
          }}
        />
      )}

      {/* 7. Real-Time Audit Log Modal */}
      <AuditLogDrawer
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
      />

      {/* 8. Filter Options Pop-up Window Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <Menu className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Select Operational Filter</h3>
                  <p className="text-[11px] text-slate-400">Choose filter view for operational groups</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Close filter window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-2.5 max-h-[75vh] overflow-y-auto">
              {[
                {
                  id: 'all',
                  title: 'All Operations',
                  desc: 'Display all flight turnaround and terminal operations',
                  badge: `${dayData.groups.length} Groups`,
                  icon: Filter,
                  activeColor: 'bg-slate-900 text-white border-slate-900',
                },
                {
                  id: 'flights',
                  title: 'Flight Turnarounds',
                  desc: 'Focus exclusively on turnaround flights (AI-102, AI-304, etc.)',
                  badge: '4 Flights',
                  icon: Plane,
                  activeColor: 'bg-blue-600 text-white border-blue-600',
                },
                {
                  id: 'terminal',
                  title: 'Terminal Ops & Infrastructure',
                  desc: 'Security, Baggage, Catering, Ramp Safety & Fueling',
                  badge: '4 Groups',
                  icon: Building2,
                  activeColor: 'bg-blue-600 text-white border-blue-600',
                },
                {
                  id: 'pending',
                  title: 'Pending Checks',
                  desc: 'Groups with active or uncompleted operational items',
                  badge: 'In Progress',
                  icon: Clock,
                  activeColor: 'bg-amber-500 text-slate-950 border-amber-500',
                },
                {
                  id: 'completed',
                  title: 'Completed Operations',
                  desc: 'Groups with 100% verified complete checklist tasks',
                  badge: 'Completed',
                  icon: CheckCircle2,
                  activeColor: 'bg-emerald-600 text-white border-emerald-600',
                },
                {
                  id: 'non-compliance',
                  title: 'Non-Compliance Review',
                  desc: 'Groups containing Missed or Incorrectly Executed items',
                  badge: `${nonComplianceGroupCount} Non-Compliant`,
                  icon: AlertCircle,
                  activeColor: 'bg-rose-600 text-white border-rose-600',
                },
              ].map((item) => {
                const ItemIcon = item.icon;
                const isSelected = filterCategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFilterCategory(item.id as any);
                      setIsFilterModalOpen(false);
                    }}
                    className={`p-3.5 rounded-xl border transition text-left flex items-start gap-3 w-full ${
                      isSelected
                        ? `${item.activeColor} shadow-md ring-2 ring-offset-1 ring-blue-500/50`
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>
                      <ItemIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider">{item.title}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 line-clamp-1 ${isSelected ? 'opacity-90' : 'text-slate-500'}`}>
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Active Filter: <strong className="uppercase text-slate-800 font-mono">{filterCategory}</strong></span>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Search Modal */}
      <ChecklistSearchModal
        isOpen={isChecklistSearchOpen}
        onClose={() => setIsChecklistSearchOpen(false)}
        dayData={dayData}
        currentUser={currentUser}
        onSelectChecklist={(grp, sub, chk) => {
          setIsChecklistSearchOpen(false);
          setActiveChecklistModal({
            isOpen: true,
            group: grp,
            subGroup: sub,
            checklist: chk,
          });
        }}
      />

      {/* Floating Search Action Button on Mobile */}
      <div className="fixed bottom-5 right-5 sm:hidden z-40">
        <button
          id="btn-mobile-floating-search-checklist"
          type="button"
          onClick={() => setIsChecklistSearchOpen(true)}
          className="w-13 h-13 rounded-full bg-blue-600 active:bg-blue-700 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center border-2 border-white/50 active:scale-95 transition cursor-pointer"
          title="Search Checklists & Choose Flight"
          aria-label="Search Checklists & Choose Flight"
        >
          <Search className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
