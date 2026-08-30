import * as XLSX from 'xlsx';
import {
  UserAccount,
  UserRole,
  DayOperationalData,
  OperationalGroup,
  SubOperationalGroup,
  Checklist,
  ChecklistItem,
  AuditLogEntry,
} from '@/types/aviation';
import {
  DEFAULT_USERS,
  createInitialDayData,
  makeItem,
  FLIGHT_CODES,
  cleanSampleSubGroups,
  getUpcomingDateStrings,
  getPurgeCutoffDateString,
  mergeMasterHierarchyWithExisting,
} from './initialData';
import {
  loginWithFirebase,
  updateUserPasswordInFirebase,
  resetUserPasswordInFirebase,
  saveDayDataToFirestore,
  propagateAdminGroupChangesToActiveShifts,
  loadDayDataFromFirestore,
  ensureDateWindowInitialized,
  purgeOldShiftsAndAuditLogs,
  logAuditEvent,
  seedDefaultUsersIfMissing,
  seedTemplatesIfMissing,
  uNumberToEmail,
  fetchUsersFromFirestore,
  saveUserToFirestore,
  saveUsersToFirestoreBatch,
  deleteUserFromFirestore,
  subscribeToUsersFromFirestore,
  subscribeToAuditLogs,
  safeJsonStringify,
} from './firestoreService';
import { db, auth } from './firebase';

const SESSION_STORAGE_KEY = 'av_ops_session_v1';

// Helper for session state in browser window
function getSessionItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.error('SessionStorage write error:', e);
  }
}

// ----------------- IN-MEMORY STATE BACKED BY FIRESTORE -----------------

const LEGACY_DEMO_UNUMBERS = new Set(['u10482', 'u20914', 'u33418', 'u44920', 'u55812']);

function deduplicateUsers(users: UserAccount[]): UserAccount[] {
  const seen = new Set<string>();
  const result: UserAccount[] = [];
  for (const u of users) {
    if (!u || !u.uNumber) continue;
    const key = u.uNumber.trim().toLowerCase();
    if (LEGACY_DEMO_UNUMBERS.has(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      // Upgrade all USER roles to SUPERVISOR role
      const upgradedRole: UserAccount['role'] = u.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR';
      const upgradedBaseRole: UserRole = u.baseRole === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR';
      result.push({
        ...u,
        role: upgradedRole,
        baseRole: upgradedBaseRole,
      });
    }
  }
  return result;
}

function getLocalUsers(): UserAccount[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('aviation_users_local');
      if (stored) {
        const parsed = JSON.parse(stored) as UserAccount[];
        return parsed.map((u) => ({
          ...u,
          role: u.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR',
          baseRole: u.baseRole === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR',
        }));
      }
    } catch (e) {
      console.error('Error loading users from localStorage:', e);
    }
  }
  return [];
}

let inMemoryUsers: UserAccount[] = deduplicateUsers([...getLocalUsers(), ...DEFAULT_USERS]);
let inMemoryAuditLogs: AuditLogEntry[] = [];

// Initialize and seed Firebase collections, then bind real-time listeners
if (typeof window !== 'undefined') {
  seedDefaultUsersIfMissing();
  seedTemplatesIfMissing();

  fetchUsersFromFirestore().then((remoteUsers) => {
    if (remoteUsers && remoteUsers.length > 0) {
      inMemoryUsers = deduplicateUsers([...remoteUsers, ...getLocalUsers()]);
      try {
        localStorage.setItem('aviation_users_local', safeJsonStringify(inMemoryUsers));
      } catch {}
      window.dispatchEvent(new Event('aviation_users_change'));
    }
  });

  subscribeToUsersFromFirestore((remoteUsers) => {
    if (remoteUsers && remoteUsers.length > 0) {
      inMemoryUsers = deduplicateUsers([...remoteUsers, ...getLocalUsers()]);
      try {
        localStorage.setItem('aviation_users_local', safeJsonStringify(inMemoryUsers));
      } catch {}
      window.dispatchEvent(new Event('aviation_users_change'));
    }
  });

  subscribeToAuditLogs((remoteLogs) => {
    if (remoteLogs && remoteLogs.length > 0) {
      inMemoryAuditLogs = remoteLogs;
      window.dispatchEvent(new Event('aviation_audit_logs_change'));
    }
  });
}

// ----------------- USER MANAGEMENT -----------------

export function loadUsers(): UserAccount[] {
  return deduplicateUsers([...inMemoryUsers, ...getLocalUsers()]);
}

export function saveUsers(users: UserAccount[]): void {
  const cleanList = deduplicateUsers(users);
  inMemoryUsers = cleanList;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('aviation_users_local', safeJsonStringify(cleanList));
    } catch (e) {
      console.error('Error saving users to localStorage:', e);
    }
  }
  
  saveUsersToFirestoreBatch(cleanList).catch((err) => {
    console.error('saveUsersToFirestoreBatch error:', err);
  });
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aviation_users_change'));
  }
}

export function getActiveSession(): UserAccount | null {
  const stored = getSessionItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const user = JSON.parse(stored) as UserAccount;
    if (user) {
      const resolvedRole: UserAccount['role'] = user.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR';
      const resolvedBaseRole: UserRole = user.baseRole === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR';
      return {
        ...user,
        role: resolvedRole,
        baseRole: resolvedBaseRole,
      };
    }
    return user;
  } catch {
    return null;
  }
}

export function setActiveSession(user: UserAccount | null): void {
  if (!user) {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {}
      window.dispatchEvent(new Event('aviation_session_change'));
    }
  } else {
    setSessionItem(SESSION_STORAGE_KEY, safeJsonStringify(user));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('aviation_session_change'));
    }
  }
}

export function subscribeSession(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('aviation_session_change', callback);
  window.addEventListener('aviation_users_change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('aviation_session_change', callback);
    window.removeEventListener('aviation_users_change', callback);
  };
}

export function subscribeUsers(callback: (users: UserAccount[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  // Call initially with latest state
  callback(loadUsers());
  
  const handleUsersChange = () => {
    callback(loadUsers());
  };
  
  window.addEventListener('aviation_users_change', handleUsersChange);
  window.addEventListener('storage', handleUsersChange);
  
  return () => {
    window.removeEventListener('aviation_users_change', handleUsersChange);
    window.removeEventListener('storage', handleUsersChange);
  };
}

let cachedSessionSnapshot: UserAccount | null | undefined = undefined;
let lastStoredRaw: string | null = null;

export function getSessionSnapshot(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  const stored = getSessionItem(SESSION_STORAGE_KEY);
  if (stored !== lastStoredRaw) {
    lastStoredRaw = stored;
    try {
      cachedSessionSnapshot = stored ? JSON.parse(stored) : null;
    } catch {
      cachedSessionSnapshot = null;
    }
  }
  return cachedSessionSnapshot !== undefined ? cachedSessionSnapshot : null;
}

export function getSessionServerSnapshot(): UserAccount | null {
  return null;
}

export async function authenticateUserAsync(
  usernameInput: string,
  passwordInput?: string,
  requestedRole?: UserRole
): Promise<{ success: boolean; user?: UserAccount; error?: string; mustChangePassword?: boolean }> {
  const cleanUsername = usernameInput.trim();
  if (!cleanUsername) {
    return { success: false, error: 'Please provide a valid U-Number or username.' };
  }

  const pwd = passwordInput || '';
  if (!pwd) {
    return { success: false, error: 'Password is required to authenticate.' };
  }

  const users = loadUsers();
  let user = users.find((u) => u.uNumber.toLowerCase() === cleanUsername.toLowerCase());

  if (user) {
    const expectedPassword = user.passwordHash || user.uNumber;
    if (pwd !== expectedPassword) {
      return { success: false, error: 'Invalid password. Please check your credentials.' };
    }
  } else {
    const fbResult = await loginWithFirebase(cleanUsername, pwd);
    if (fbResult.success && fbResult.user) {
      user = fbResult.user;
    } else {
      return { success: false, error: fbResult.error || 'User account not found or invalid credentials.' };
    }
  }

  const baseRole: UserRole = user.baseRole || user.role || 'USER';
  const activeRole: UserRole = requestedRole || baseRole;

  if (baseRole === 'USER' && activeRole !== 'USER') {
    return {
      success: false,
      error: `Access Denied: Account (${user.uNumber}) has base role 'User' and can only sign in as User role. Contact an Administrator to change your role tier.`,
    };
  }

  if (baseRole === 'SUPERVISOR' && activeRole === 'ADMIN') {
    return {
      success: false,
      error: `Access Denied: Account (${user.uNumber}) has base role 'SUPERVISOR' and can only sign in as Supervisor or User role.`,
    };
  }

  const sessionUser: UserAccount = {
    ...user,
    role: activeRole,
    baseRole: baseRole,
  };

  setActiveSession(sessionUser);

  return {
    success: true,
    user: sessionUser,
    mustChangePassword: user.mustChangePassword || false,
  };
}

export function authenticateUser(
  usernameInput: string,
  passwordInput?: string,
  requestedRole?: UserRole
): { success: boolean; user?: UserAccount; error?: string; mustChangePassword?: boolean } {
  const cleanUsername = usernameInput.trim();
  if (!cleanUsername) {
    return { success: false, error: 'Please provide a valid U-Number or username.' };
  }

  const pwd = passwordInput || '';
  if (!pwd) {
    return { success: false, error: 'Password is required to authenticate.' };
  }

  const users = loadUsers();
  const user = users.find((u) => u.uNumber.toLowerCase() === cleanUsername.toLowerCase());

  if (!user) {
    return { success: false, error: 'User account not found. Please verify your U-Number or contact your supervisor.' };
  }

  const expectedPassword = user.passwordHash || user.uNumber;
  if (pwd !== expectedPassword) {
    return { success: false, error: 'Invalid password. Please check your credentials.' };
  }

  const baseRole: UserRole = user.baseRole || user.role || 'USER';
  const activeRole: UserRole = requestedRole || baseRole;

  if (baseRole === 'USER' && activeRole !== 'USER') {
    return {
      success: false,
      error: `Access Denied: Account (${user.uNumber}) has base role 'User' and can only sign in as User role.`,
    };
  }

  if (baseRole === 'SUPERVISOR' && activeRole === 'ADMIN') {
    return {
      success: false,
      error: `Access Denied: Account (${user.uNumber}) has base role 'SUPERVISOR' and can only sign in as Supervisor or User role.`,
    };
  }

  const sessionUser: UserAccount = {
    ...user,
    role: activeRole,
    baseRole: baseRole,
  };

  setActiveSession(sessionUser);

  return {
    success: true,
    user: sessionUser,
    mustChangePassword: user.mustChangePassword || false,
  };
}

export async function updateUserPasswordAsync(
  uNumber: string,
  newPassword: string
): Promise<boolean> {
  const localSuccess = updateUserPassword(uNumber, newPassword);
  try {
    await updateUserPasswordInFirebase(uNumber, newPassword);
  } catch (e) {
    console.warn('Firebase password update synced:', e);
  }
  return localSuccess;
}

export function updateUserPassword(uNumber: string, newPassword: string): boolean {
  const users = loadUsers();
  const index = users.findIndex((u) => u.uNumber.toLowerCase() === uNumber.toLowerCase());
  if (index === -1) return false;

  users[index].passwordHash = newPassword;
  users[index].mustChangePassword = false;
  saveUserToFirestore(users[index]);

  const current = getActiveSession();
  if (current && current.uNumber.toLowerCase() === uNumber.toLowerCase()) {
    setActiveSession(users[index]);
  }

  addAuditLog(uNumber, users[index].name, users[index].role, 'PASSWORD_CHANGE', 'User updated password successfully.');
  return true;
}

export async function resetUserPasswordAsync(
  uNumber: string,
  adminUser: UserAccount
): Promise<boolean> {
  const localSuccess = resetUserPassword(uNumber, adminUser);
  try {
    await resetUserPasswordInFirebase(uNumber, adminUser);
  } catch (e) {
    console.warn('Firebase reset password synced:', e);
  }
  return localSuccess;
}

export function resetUserPassword(uNumber: string, adminUser: UserAccount): boolean {
  const users = loadUsers();
  const index = users.findIndex((u) => u.uNumber.toLowerCase() === uNumber.toLowerCase());
  if (index === -1) return false;

  const target = users[index];
  target.passwordHash = target.uNumber;
  target.mustChangePassword = true;
  saveUserToFirestore(target);

  addAuditLog(
    adminUser.uNumber,
    adminUser.name,
    adminUser.role,
    'ADMIN_PASSWORD_RESET',
    `Reset password for ${target.name} (${target.uNumber}) back to initial U-Number.`
  );
  return true;
}

export function addOrUpdateUser(user: UserAccount, performer?: UserAccount): void {
  const index = inMemoryUsers.findIndex((u) => u.uNumber.toLowerCase() === user.uNumber.toLowerCase());
  if (index >= 0) {
    inMemoryUsers[index] = { ...inMemoryUsers[index], ...user };
  } else {
    inMemoryUsers.push(user);
  }
  inMemoryUsers = deduplicateUsers(inMemoryUsers);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('aviation_users_local', safeJsonStringify(inMemoryUsers));
    } catch {}
  }
  saveUserToFirestore(user).catch((err) => {
    console.error('saveUserToFirestore error:', err);
  });

  if (performer) {
    addAuditLog(performer.uNumber, performer.name, performer.role, 'USER_UPSERT', `Created/Updated user ${user.name} (${user.uNumber}) with role ${user.role}.`);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aviation_users_change'));
  }
}

export function deleteUserAccount(uNumber: string, adminUser: UserAccount): boolean {
  inMemoryUsers = inMemoryUsers.filter((u) => u.uNumber.toLowerCase() !== uNumber.toLowerCase());
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('aviation_users_local', safeJsonStringify(inMemoryUsers));
    } catch {}
  }
  deleteUserFromFirestore(uNumber);
  addAuditLog(adminUser.uNumber, adminUser.name, adminUser.role, 'USER_DELETE', `Deleted user ${uNumber}.`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aviation_users_change'));
  }
  return true;
}

// ----------------- OPERATIONAL DAY DATA -----------------

export function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultDateString(): string {
  const now = new Date();
  const hours = now.getHours();
  if (hours >= 17) {
    now.setDate(now.getDate() + 1);
  }
  return formatDateToYYYYMMDD(now);
}

export function getTodayDateString(): string {
  return getDefaultDateString();
}

export function loadDayData(dateStr: string): DayOperationalData {
  // Always return the fresh initial DayData template as the shell.
  // The React client's real-time listeners for Firestore will immediately hydradate
  // the state with up-to-date document states directly from Firebase.
  return createInitialDayData(dateStr);
}

export function saveDayData(data: DayOperationalData): void {
  data.lastUpdated = new Date().toISOString();
  try {
    saveDayDataToFirestore(data);
    propagateAdminGroupChangesToActiveShifts(data);
  } catch (err) {
    console.warn('saveDayData error:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aviation_day_data_change'));
  }
}

// Reset an operational day to initial blank state (Admin utility)
export function resetDayDataToDefault(dateStr: string, adminUser: UserAccount): DayOperationalData {
  const fresh = createInitialDayData(dateStr);
  saveDayData(fresh);
  addAuditLog(adminUser.uNumber, adminUser.name, adminUser.role, 'DAY_DATA_RESET', `Reset operational state for ${dateStr} to defaults.`);
  return fresh;
}

// ----------------- ROLLING 10-DAY WINDOW & 1-MONTH RETENTION EXPORTS -----------------

export { ensureDateWindowInitialized, purgeOldShiftsAndAuditLogs, getUpcomingDateStrings, getPurgeCutoffDateString };

/**
 * Clean up local storage cached records older than 30 days
 */
export function purgeLocalStaleData(retentionDays: number = 30): number {
  if (typeof window === 'undefined') return 0;
  const cutoffStr = getPurgeCutoffDateString(retentionDays);
  let purgedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('aviation_day_data_') || key.startsWith('day_data_'))) {
        const datePart = key.replace('aviation_day_data_', '').replace('day_data_', '');
        if (datePart && datePart < cutoffStr) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      purgedCount += 1;
    });
  } catch (e) {
    console.warn('purgeLocalStaleData notice:', e);
  }
  return purgedCount;
}

// ----------------- AUDIT LOGS -----------------

export function loadAuditLogs(): AuditLogEntry[] {
  return inMemoryAuditLogs;
}

export function addAuditLog(
  uNumber: string,
  userName: string,
  userRole: UserAccount['role'],
  action: string,
  details: string,
  dateTarget?: string
): void {
  const newEntry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    dateTarget: dateTarget || getTodayDateString(),
    uNumber,
    userName,
    userRole,
    action,
    details,
  };
  inMemoryAuditLogs.unshift(newEntry);
  if (inMemoryAuditLogs.length > 300) inMemoryAuditLogs.pop();

  let actType: any = 'ITEM_STATUS_CHANGE';
  if (action.includes('LOGIN')) actType = 'LOGIN';
  else if (action.includes('LOGOUT')) actType = 'LOGOUT';
  else if (action.includes('PASSWORD')) actType = 'PASSWORD_CHANGE';
  else if (action.includes('SUBMIT')) actType = 'CHECKLIST_SUBMIT';
  else if (action.includes('VERIFY')) actType = 'SUPERVISOR_VERIFY';
  else if (action.includes('SHIFT') || action.includes('CLOSURE')) actType = 'SHIFT_CLOSURE';
  else if (action.includes('EXCEL') || action.includes('IMPORT')) actType = 'EXCEL_IMPORT';
  else if (action.includes('RESET')) actType = 'PASSWORD_RESET';

  let targetEntity: any = 'CHECKLIST';
  if (action.includes('USER') || action.includes('PASSWORD')) targetEntity = 'USER';
  else if (action.includes('GROUP')) targetEntity = 'OP_GROUP';
  else if (action.includes('SHIFT')) targetEntity = 'SHIFT';

  try {
    logAuditEvent({
      actionType: actType,
      targetEntity: targetEntity,
      targetId: uNumber,
      details: { message: details, action },
      dateScope: dateTarget || getTodayDateString(),
      actorUser: {
        uNumber,
        name: userName,
        role: userRole,
        passwordHash: '',
        mustChangePassword: false,
        department: 'Ground Operations',
        createdDate: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('logAuditEvent error:', e);
  }
}

// Re-export fetchShiftsForDateRange
export { fetchShiftsForDateRange } from './firestoreService';

// Non-Compliance Record interface for date range analysis & export
export interface NonComplianceRecord {
  date: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  isFlightGroup: boolean;
  subGroupName: string;
  checklistTitle: string;
  seqNo: number;
  itemText: string;
  isMandatory: boolean;
  status: 'missed' | 'incorrectly_executed';
  remark: string;
  actionBy: string;
  actionAt: string;
}

// Compile all missed and incorrectly executed checklist items across multiple historical shifts
export function compileNonComplianceRecords(shifts: DayOperationalData[]): NonComplianceRecord[] {
  const records: NonComplianceRecord[] = [];

  for (const shift of shifts) {
    if (!shift || !shift.groups) continue;
    for (const group of shift.groups) {
      if (!group || !group.subGroups) continue;
      for (const sub of group.subGroups) {
        if (!sub || !sub.checklists) continue;
        for (const chk of sub.checklists) {
          if (!chk || !chk.items) continue;
          for (const item of chk.items) {
            if (item.status === 'missed' || item.status === 'incorrectly_executed') {
              records.push({
                date: shift.date,
                groupId: group.id,
                groupName: group.name,
                groupCode: group.code,
                isFlightGroup: group.isFlightGroup,
                subGroupName: sub.name,
                checklistTitle: chk.title,
                seqNo: item.sequenceOrder,
                itemText: item.text,
                isMandatory: item.isMandatory,
                status: item.status,
                remark: item.remark || '',
                actionBy: item.actionBy || '',
                actionAt: item.actionAt || '',
              });
            }
          }
        }
      }
    }
  }

  // Sort descending by date
  records.sort((a, b) => b.date.localeCompare(a.date) || a.seqNo - b.seqNo);

  return records;
}

// ----------------- HIERARCHICAL STATUS CALCULATIONS -----------------

export function isChecklistComplete(chk: Checklist): boolean {
  if (!chk.items || chk.items.length === 0) return true;
  // All items must be processed (i.e. 'done', 'skipped', 'missed', or 'incorrectly_executed')
  return chk.items.every((item) => {
    return (
      item.status === 'done' ||
      item.status === 'skipped' ||
      item.status === 'missed' ||
      item.status === 'incorrectly_executed'
    );
  });
}

export function getChecklistProgress(chk: Checklist): {
  done: number;
  total: number;
  skipped: number;
  pinned: number;
  missed: number;
  incorrectlyExecuted: number;
  pending: number;
  percent: number;
} {
  const items = chk.items || [];
  const total = items.length;
  const done = items.filter((i) => i.status === 'done').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;
  const pinned = items.filter((i) => i.status === 'pinned').length;
  const missed = items.filter((i) => i.status === 'missed').length;
  const incorrectlyExecuted = items.filter((i) => i.status === 'incorrectly_executed').length;
  const pending = items.filter((i) => i.status === 'not_done').length;
  const processed = done + skipped + missed + incorrectlyExecuted;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 100;
  return { done, total, skipped, pinned, missed, incorrectlyExecuted, pending, percent };
}

export function getChecklistStatusDisplay(chk: Checklist): {
  label: string;
  isComplete: boolean;
  hasNonCompliance: boolean;
  missedCount: number;
  incorrectCount: number;
} {
  const prog = getChecklistProgress(chk);
  const isComplete = chk.status === 'completed';
  const missedCount = prog.missed;
  const incorrectCount = prog.incorrectlyExecuted;
  const hasNonCompliance = missedCount > 0 || incorrectCount > 0;

  if (isComplete) {
    if (hasNonCompliance) {
      const parts: string[] = [];
      if (missedCount > 0) parts.push(`${missedCount} Missed`);
      if (incorrectCount > 0) parts.push(`${incorrectCount} Incorrectly Executed`);
      return {
        label: `Completed (${parts.join(', ')})`,
        isComplete: true,
        hasNonCompliance: true,
        missedCount,
        incorrectCount,
      };
    }
    return {
      label: 'Completed',
      isComplete: true,
      hasNonCompliance: false,
      missedCount: 0,
      incorrectCount: 0,
    };
  }

  return {
    label: prog.done > 0 ? `In-Progress (${prog.done}/${prog.total})` : `Pending (${prog.total} items)`,
    isComplete: false,
    hasNonCompliance: false,
    missedCount,
    incorrectCount,
  };
}

export function isSubGroupComplete(sub: SubOperationalGroup, groupName?: string): boolean {
  if (!sub.checklists || sub.checklists.length === 0) return true;
  return sub.checklists.every((chk) => {
    return chk.status === 'completed';
  });
}

export function isGroupComplete(grp: OperationalGroup): boolean {
  if (!grp.subGroups || grp.subGroups.length === 0) return true;
  return grp.subGroups.every((sub) => isSubGroupComplete(sub, grp.name));
}

export function isDayShiftFullyCompleteAndVerified(dayData: DayOperationalData): boolean {
  if (!dayData.groups || dayData.groups.length === 0) return false;
  // All groups must be both complete AND verified by supervisor
  return dayData.groups.every((grp) => isGroupComplete(grp) && grp.isVerified);
}

export function getDayOverallProgress(dayData: DayOperationalData): {
  totalItems: number;
  doneItems: number;
  skippedItems: number;
  pinnedItems: number;
  missedItems: number;
  incorrectItems: number;
  percent: number;
  completedGroups: number;
  totalGroups: number;
  verifiedGroups: number;
} {
  let totalItems = 0;
  let doneItems = 0;
  let skippedItems = 0;
  let pinnedItems = 0;
  let missedItems = 0;
  let incorrectItems = 0;
  let completedGroups = 0;
  let verifiedGroups = 0;

  const groups = (dayData.groups || []).filter(g => !g.name.includes('Day Shift') && g.code !== 'DAY-OPS');
  const totalGroups = groups.length;

  for (const grp of groups) {
    if (isGroupComplete(grp)) completedGroups++;
    if (grp.isVerified) verifiedGroups++;

    for (const sub of grp.subGroups || []) {
      for (const chk of sub.checklists || []) {
        if (
          (grp.name.includes('Day Shift')) &&
          sub.name === 'General Operations' &&
          chk.title === 'Duty 2 Checklist'
        ) {
          continue; // Exclude from overall progress
        }
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

  const processedItems = doneItems + skippedItems + missedItems + incorrectItems;
  const percent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

  return {
    totalItems,
    doneItems,
    skippedItems,
    pinnedItems,
    missedItems,
    incorrectItems,
    percent,
    completedGroups,
    totalGroups,
    verifiedGroups,
  };
}

// ----------------- SHEETJS EXCEL ENGINES -----------------

// Parse user Excel file
export function parseUsersExcel(
  fileData: ArrayBuffer
): Promise<{ added: number; skipped: number; errors: string[]; parsedUsers: UserAccount[] }> {
  return new Promise((resolve) => {
    try {
      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const currentUsers = loadUsers();
      const existingUNumbers = new Set(currentUsers.map((u) => u.uNumber.toLowerCase().trim()));

      let added = 0;
      let skipped = 0;
      const errors: string[] = [];
      const newUsers: UserAccount[] = [];

      // Loop through rows skipping empty ones or possible header
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        let col1 = String(row[0] || '').trim();
        let col2 = String(row[1] || '').trim();
        let col3 = String(row[2] || '').trim(); // Optional Role or Department

        // Detect if row is a header row like "U-Number" / "Employee Name"
        if (
          i === 0 &&
          (col1.toLowerCase().includes('u-number') ||
            col1.toLowerCase().includes('username') ||
            col1.toLowerCase().includes('unumber') ||
            col2.toLowerCase().includes('name') ||
            col2.toLowerCase().includes('employee'))
        ) {
          continue; // Skip header
        }

        if (!col1 || !col2) {
          if (col1 || col2) errors.push(`Row ${i + 1}: Missing U-Number or Employee Name`);
          continue;
        }

        const normalizedUNum = col1.toUpperCase();

        if (existingUNumbers.has(normalizedUNum.toLowerCase())) {
          skipped++;
          continue;
        }

        // Determine role (default USER, or check col3)
        let role: UserAccount['role'] = 'USER';
        if (col3.toUpperCase().includes('SUPERVISOR')) role = 'SUPERVISOR';
        else if (col3.toUpperCase().includes('ADMIN')) role = 'ADMIN';

        const newUser: UserAccount = {
          uNumber: normalizedUNum,
          name: col2,
          role,
          passwordHash: normalizedUNum, // Initial password is same as U-Number
          mustChangePassword: true,
          department: col3 && !['USER', 'SUPERVISOR', 'ADMIN'].includes(col3.toUpperCase()) ? col3 : 'Ground Operations',
          createdDate: new Date().toISOString(),
        };

        newUsers.push(newUser);
        existingUNumbers.add(normalizedUNum.toLowerCase());
        added++;
      }

      resolve({ added, skipped, errors, parsedUsers: newUsers });
    } catch (err: any) {
      resolve({ added: 0, skipped: 0, errors: [err?.message || 'Failed to read Excel workbook'], parsedUsers: [] });
    }
  });
}

// Parse checklist items Excel file
export function parseChecklistExcel(
  fileData: ArrayBuffer
): Promise<{ items: ChecklistItem[]; errors: string[] }> {
  return new Promise((resolve) => {
    try {
      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const parsedItems: ChecklistItem[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const col1 = String(row[0] || '').trim(); // Serial No / Seq
        const col2 = String(row[1] || '').trim(); // Description
        const col3 = String(row[2] || '').trim(); // Optional Mandatory (Y/N or true/false)

        // Check if header row
        if (
          i === 0 &&
          (col1.toLowerCase().includes('seq') ||
            col1.toLowerCase().includes('serial') ||
            col1.toLowerCase().includes('no') ||
            col2.toLowerCase().includes('item') ||
            col2.toLowerCase().includes('description') ||
            col2.toLowerCase().includes('check'))
        ) {
          continue;
        }

        if (!col2 && !col1) continue;

        const seqNo = parseInt(col1, 10) || parsedItems.length + 1;
        const text = col2 || col1; // Fallback if user only filled one column

        // Default mandatory = true unless explicitly marked N / No / False / Optional
        let isMandatory = true;
        if (col3) {
          const lower = col3.toLowerCase();
          if (lower === 'n' || lower === 'no' || lower === 'false' || lower === 'optional' || lower === '0') {
            isMandatory = false;
          }
        }

        parsedItems.push(makeItem(`imp-${Date.now()}-${parsedItems.length + 1}`, seqNo, text, isMandatory));
      }

      resolve({ items: parsedItems, errors });
    } catch (err: any) {
      resolve({ items: [], errors: [err?.message || 'Failed to read Checklist Excel workbook'] });
    }
  });
}

// Generate sample Excel template for users
export function downloadUserImportTemplate(): void {
  const sampleData = [
    ['U-Number', 'Employee Name', 'Department / Role'],
    ['U61029', 'Jean-Luc Picard', 'Ramp Marshalling'],
    ['U74820', 'Kathryn Janeway', 'SUPERVISOR'],
    ['U88319', 'Geordi La Forge', 'Aircraft Fueling & GSE'],
    ['U90123', 'Beverly Crusher', 'Cabin Servicing'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  // Column widths
  ws['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users_Import_Template');
  XLSX.writeFile(wb, 'Aviation_Users_Import_Template.xlsx');
}

// Generate sample Excel template for checklists
export function downloadChecklistImportTemplate(): void {
  const sampleData = [
    ['Serial No', 'Checklist Item Description', 'Is Mandatory (Y/N)'],
    [1, 'Verify main landing gear safety ground locks are engaged', 'Y'],
    [2, 'Inspect engine nacelle and fan blades for foreign object ingestion', 'Y'],
    [3, 'Confirm pitot static covers are removed with streamers stored', 'Y'],
    [4, 'Check potable water fill cap gasket seal integrity', 'N'],
    [5, 'Cross-check fuel hydrometer specific gravity temperature reading', 'Y'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist_Template');
  XLSX.writeFile(wb, 'Aviation_Checklist_Import_Template.xlsx');
}

// Export full operational shift log to Excel
export function exportShiftToExcel(dayData: DayOperationalData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Shift Summary
  const summary = getDayOverallProgress(dayData);
  const summaryRows = [
    ['AVIATION GROUND OPERATIONS SHIFT AUDIT LOG'],
    ['Target Date:', dayData.date],
    ['Shift Status:', dayData.isShiftClosed ? 'CLOSED & VERIFIED' : 'IN-PROGRESS'],
    ['Shift Closed By:', dayData.closedBy || 'N/A'],
    ['Closure Timestamp:', dayData.closedAt || 'N/A'],
    ['Shift Notes:', dayData.shiftNotes || 'N/A'],
    ['Total Operational Groups:', summary.totalGroups],
    ['Completed Groups:', summary.completedGroups],
    ['Supervisor Verified Groups:', summary.verifiedGroups],
    ['Overall Completion %:', `${summary.percent}%`],
    ['Total Items Executed:', summary.totalItems],
    ['Items Done:', summary.doneItems],
    ['Items Skipped (Optional):', summary.skippedItems],
    ['Items Pinned:', summary.pinnedItems],
    ['Items Missed:', summary.missedItems],
    ['Items Incorrectly Executed:', summary.incorrectItems],
    [],
    ['Detailed Item Execution Breakdown: See next sheet'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Shift_Summary');

  // Sheet 2: Item by Item Audit
  const itemRows: any[][] = [
    [
      'Operational Group',
      'Group Type',
      'Verified by Supervisor',
      'Sub-Operational Group',
      'Checklist Name',
      'Seq No',
      'Checklist Item Text',
      'Mandatory?',
      'Status',
      'Executed By',
      'Executed At',
      'Operator Free-Text Remark / Reason',
    ],
  ];

  for (const grp of dayData.groups) {
    for (const sub of grp.subGroups) {
      for (const chk of sub.checklists) {
        for (const item of chk.items) {
          itemRows.push([
            grp.name,
            grp.isFlightGroup ? 'Flight Turnaround' : 'Terminal Ops',
            grp.isVerified ? `YES (${grp.verifiedBy})` : 'NO',
            sub.name,
            chk.title,
            item.sequenceOrder,
            item.text,
            item.isMandatory ? 'YES' : 'NO',
            item.status.toUpperCase(),
            item.actionBy || chk.completedBy || 'N/A',
            item.actionAt || chk.completedAt || 'N/A',
            item.remark || item.skipReason || chk.remarks || '',
          ]);
        }
      }
    }
  }

  const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
  wsItems['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 },
    { wch: 32 },
    { wch: 8 },
    { wch: 50 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Detailed_Audit_Log');

  XLSX.writeFile(wb, `Aviation_Ground_Ops_Audit_${dayData.date}.xlsx`);
}

// Export Non-Compliance Report (Missed & Incorrectly Executed Items) Over Date Range to Excel
export function exportNonComplianceReportToExcel(
  records: NonComplianceRecord[],
  startDate: string,
  endDate: string
): void {
  const wb = XLSX.utils.book_new();

  const missedCount = records.filter((r) => r.status === 'missed').length;
  const incorrectCount = records.filter((r) => r.status === 'incorrectly_executed').length;

  // Sheet 1: Executive Non-Compliance Summary
  const summaryRows = [
    ['AVIATION GROUND OPERATIONS - NON-COMPLIANCE AUDIT REPORT'],
    ['Report Date Range:', `${startDate} to ${endDate}`],
    ['Export Timestamp:', new Date().toLocaleString()],
    ['Total Non-Compliance Occurrences:', records.length],
    ['Total Missed Items:', missedCount],
    ['Total Incorrectly Executed Items:', incorrectCount],
    [],
    ['Detailed Item Log: See "Non_Compliance_Log" sheet'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Audit_Summary');

  // Sheet 2: Detailed Non-Compliance Log
  const logRows: any[][] = [
    [
      'Date',
      'Flight / Op Group',
      'Group Type',
      'Sub-Group',
      'Checklist Title',
      'Seq No',
      'Checklist Item Text',
      'Mandatory?',
      'Execution Status',
      'Operator / Auditor',
      'Action Timestamp',
      'Free-Text Remark / Operational Reason',
    ],
  ];

  records.forEach((rec) => {
    logRows.push([
      rec.date,
      rec.groupName,
      rec.isFlightGroup ? 'Flight Turnaround' : 'Terminal / General Ops',
      rec.subGroupName,
      rec.checklistTitle,
      rec.seqNo,
      rec.itemText,
      rec.isMandatory ? 'YES' : 'NO',
      rec.status === 'missed' ? 'MISSED' : 'INCORRECTLY EXECUTED',
      rec.actionBy || 'N/A',
      rec.actionAt ? new Date(rec.actionAt).toLocaleString() : 'N/A',
      rec.remark || 'No remark entered',
    ]);
  });

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 26 },
    { wch: 30 },
    { wch: 8 },
    { wch: 50 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, wsLog, 'Non_Compliance_Log');

  XLSX.writeFile(wb, `Aviation_NonCompliance_Report_${startDate}_to_${endDate}.xlsx`);
}
