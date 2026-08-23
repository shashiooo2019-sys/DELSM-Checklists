export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'USER';

export interface UserAccount {
  uNumber: string; // e.g. "admin", "supervisor", "U10482"
  name: string;
  role: UserRole;
  baseRole?: UserRole; // Assigned base role tier in personnel roster
  passwordHash: string; // Plaintext or simulated hash for demo
  mustChangePassword: boolean; // Enforced on first login if initial password
  department?: string;
  createdDate: string;
  isAuthorized?: boolean;
}

export type ItemStatus = 'not_done' | 'done' | 'skipped' | 'pinned';

export interface ChecklistItem {
  id: string;
  sequenceOrder: number;
  text: string;
  isMandatory: boolean; // Default true
  status: ItemStatus;
  actionBy?: string; // U-number or Name
  actionAt?: string; // ISO string
  skipReason?: string;
}

export type ChecklistStatus = 'pending' | 'in_progress' | 'completed';

export interface ChecklistVersionRecord {
  version: string;
  versionDate: string;
  updatedBy: string; // e.g. "U10482 (Admin)"
  itemCount: number;
  previousItemCount?: number;
  changeType: 'OVERWRITE' | 'INITIAL' | 'MANUAL_UPDATE' | 'IMPORT';
  notes?: string;
  timestamp: string;
}

export interface Checklist {
  id: string;
  title: string;
  description?: string;
  isMandatory: boolean;
  status: ChecklistStatus;
  items: ChecklistItem[];
  completedBy?: string;
  completedAt?: string;
  remarks?: string; // Free-text remarks on submit
  version?: string; // e.g. "v1.0", "v1.1"
  versionDate?: string; // e.g. "2026-08-22"
  versionHistory?: ChecklistVersionRecord[];
}

export interface SubOperationalGroup {
  id: string;
  name: string;
  code?: string;
  isMandatory: boolean;
  checklists: Checklist[];
}

export interface OperationalGroup {
  id: string;
  name: string; // e.g. "LX147", "Arrivals"
  code: string;
  isFlightGroup: boolean; // True for LX147, LX2647, LH763, LH761
  isMandatory: boolean;
  subGroups: SubOperationalGroup[];
  isVerified: boolean; // Verified by Supervisor
  verifiedBy?: string;
  verifiedAt?: string;
  supervisorNotes?: string;
}

export interface DayOperationalData {
  date: string; // YYYY-MM-DD
  groups: OperationalGroup[];
  isShiftClosed: boolean;
  closedBy?: string;
  closedAt?: string;
  shiftNotes?: string;
  lastUpdated: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  dateTarget: string;
  uNumber: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
}
