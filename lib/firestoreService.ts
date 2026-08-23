import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, db } from './firebase';
import {
  UserAccount,
  DayOperationalData,
  OperationalGroup,
  SubOperationalGroup,
  Checklist,
  ChecklistItem,
  AuditLogEntry,
  ItemStatus,
  ChecklistStatus,
} from '@/types/aviation';
import { DEFAULT_USERS, generateDefaultGroups, makeItem, FLIGHT_CODES, cleanSampleSubGroups } from './initialData';

// Domain mapping helper
export function uNumberToEmail(uNumber: string): string {
  const clean = uNumber.trim().toLowerCase();
  if (clean === 'admin') return 'admin@groundops.internal';
  if (clean === 'supervisor') return 'supervisor@groundops.internal';
  return `${clean}@groundops.internal`;
}

// ----------------- FIRESTORE ERROR HANDLING -----------------

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------- AUDIT TRAIL ENGINE -----------------

export interface LogAuditParams {
  actionType:
    | 'LOGIN'
    | 'LOGOUT'
    | 'PASSWORD_CHANGE'
    | 'ITEM_STATUS_CHANGE'
    | 'CHECKLIST_SUBMITTED'
    | 'CHECKLIST_SUBMIT'
    | 'SUPERVISOR_VERIFY'
    | 'SUPERVISOR_VERIFY_GROUP'
    | 'SUPERVISOR_REOPEN_GROUP'
    | 'SHIFT_CLOSED'
    | 'SHIFT_CLOSURE'
    | 'EXCEL_IMPORT'
    | 'PASSWORD_RESET'
    | 'USER_UPSERT'
    | 'USER_DELETE'
    | 'TEMPLATE_UPDATE'
    | 'DAY_DATA_RESET';
  targetEntity: 'USER' | 'CHECKLIST_ITEM' | 'CHECKLIST' | 'OP_GROUP' | 'SHIFT' | 'TEMPLATE';
  targetId: string;
  details?: Record<string, any> | string;
  dateScope?: string | null;
  actorUser?: UserAccount | null;
}

export async function logAuditEvent({
  actionType,
  targetEntity,
  targetId,
  details,
  dateScope = null,
  actorUser = null,
}: LogAuditParams) {
  try {
    const fbUser = auth.currentUser;
    let uid = fbUser ? fbUser.uid : actorUser?.uNumber || 'SYSTEM';
    let uNumber = actorUser?.uNumber || 'SYSTEM';
    let actorName = actorUser?.name || 'System Operator';
    let actorRole = actorUser?.role || 'USER';

    if (fbUser && !actorUser) {
      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          uNumber = data.u_number || fbUser.email?.split('@')[0] || 'SYSTEM';
          actorName = data.name || fbUser.email || 'Operator';
          actorRole = data.role || 'USER';
        }
      } catch (err) {
        console.warn('Could not read user doc for audit log:', err);
      }
    }

    const payload = {
      timestamp: serverTimestamp(),
      date_scope: dateScope || new Date().toISOString().split('T')[0],
      actor_uid: uid,
      actor_u_number: uNumber,
      actor_name: actorName,
      actor_role: actorRole,
      action_type: actionType,
      target_entity: targetEntity,
      target_id: targetId,
      details: typeof details === 'string' ? { message: details } : details || {},
    };

    await addDoc(collection(db, 'audit_logs'), payload);
  } catch (e) {
    console.error('Audit logging error:', e);
  }
}

// ----------------- USER AUTHENTICATION & DIRECTORY -----------------

export interface FirestoreUserData {
  u_number: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'USER';
  is_first_login: boolean;
  created_at: any;
  department?: string;
  uid?: string;
  password_hash?: string;
}

export const DEMO_USER_UNUMBERS = new Set(['u10482', 'u20914', 'u33418', 'u44920', 'u55812']);

// Convert Firestore User Doc to UserAccount
export function firestoreUserToAccount(data: FirestoreUserData, uid?: string): UserAccount {
  return {
    uNumber: data.u_number,
    name: data.name,
    role: data.role,
    passwordHash: data.password_hash || data.u_number || 'ACTIVE',
    mustChangePassword: false,
    department: data.department || 'Ground Operations',
    createdDate: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

// Ensure default users exist in Firestore and purge any legacy demo data
export async function seedDefaultUsersIfMissing(): Promise<void> {
  try {
    // 1. Purge legacy demo users if present in Firestore
    try {
      const allUsersSnap = await getDocs(collection(db, 'users'));
      for (const d of allUsersSnap.docs) {
        const uNum = (d.data()?.u_number || '').trim().toLowerCase();
        if (DEMO_USER_UNUMBERS.has(uNum)) {
          const { deleteDoc } = await import('firebase/firestore');
          await deleteDoc(d.ref);
        }
      }
    } catch (e) {
      console.warn('Notice while cleaning demo users from Firestore:', e);
    }

    // 2. Ensure core admin & supervisor accounts exist
    for (const def of DEFAULT_USERS) {
      const email = uNumberToEmail(def.uNumber);
      const q = query(collection(db, 'users'), where('u_number', '==', def.uNumber));
      const snap = await getDocs(q);

      if (snap.empty) {
        const uid = `u_${def.uNumber.toLowerCase()}`;
        await setDoc(doc(db, 'users', uid), {
          u_number: def.uNumber,
          email: email,
          name: def.name,
          role: def.role,
          is_first_login: false,
          department: def.department || 'Ground Operations',
          password_hash: def.passwordHash,
          created_at: serverTimestamp(),
        });
      } else {
        await updateDoc(snap.docs[0].ref, {
          password_hash: def.passwordHash,
          is_first_login: def.mustChangePassword,
        });
      }
    }
  } catch (err) {
    console.warn('seedDefaultUsersIfMissing notice:', err);
  }
}

// Authenticate via U-Number & Password
export async function loginWithFirebase(
  usernameInput: string,
  passwordInput?: string
): Promise<{
  success: boolean;
  user?: UserAccount;
  error?: string;
  mustChangePassword?: boolean;
  fbUid?: string;
}> {
  const cleanUsername = usernameInput.trim();
  const lowerUsername = cleanUsername.toLowerCase();
  const pwd = passwordInput || '';

  if (!pwd) {
    return {
      success: false,
      error: 'Password is required to authenticate.',
    };
  }

  try {
    // Query Firestore users collection
    const usersSnap = await getDocs(collection(db, 'users'));
    let foundDoc: any = null;
    let foundData: FirestoreUserData | null = null;

    for (const d of usersSnap.docs) {
      const data = d.data() as FirestoreUserData;
      if (data.u_number && data.u_number.trim().toLowerCase() === lowerUsername) {
        // Skip if demo user
        if (DEMO_USER_UNUMBERS.has(lowerUsername)) continue;
        foundDoc = d;
        foundData = data;
        break;
      }
    }

    if (foundDoc && foundData) {
      const userAccount = firestoreUserToAccount(foundData, foundDoc.id);

      // Enforce Password check
      const expectedPassword = foundData.password_hash || foundData.u_number;
      if (pwd !== expectedPassword) {
        return {
          success: false,
          error: 'Invalid password. Please check your credentials.',
        };
      }

      await logAuditEvent({
        actionType: 'LOGIN',
        targetEntity: 'USER',
        targetId: foundDoc.id,
        details: { u_number: userAccount.uNumber, role: userAccount.role },
        actorUser: userAccount,
      });

      return {
        success: true,
        user: userAccount,
        mustChangePassword: false,
        fbUid: foundDoc.id,
      };
    }

    // Check if it matches default system role (admin or supervisor)
    const defaultUser = DEFAULT_USERS.find(
      (u) => u.uNumber.toLowerCase() === lowerUsername
    );

    if (defaultUser) {
      if (pwd !== defaultUser.passwordHash) {
        return {
          success: false,
          error: 'Invalid password. Please check your credentials.',
        };
      }

      const uid = `u_${defaultUser.uNumber.toLowerCase()}`;
      const email = uNumberToEmail(defaultUser.uNumber);
      const userData: FirestoreUserData = {
        u_number: defaultUser.uNumber,
        email: email,
        name: defaultUser.name,
        role: defaultUser.role,
        is_first_login: false,
        department: defaultUser.department,
        password_hash: defaultUser.passwordHash,
        created_at: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', uid), userData);

      const userAccount = firestoreUserToAccount(userData, uid);
      await logAuditEvent({
        actionType: 'LOGIN',
        targetEntity: 'USER',
        targetId: uid,
        details: { u_number: userAccount.uNumber, role: userAccount.role },
        actorUser: userAccount,
      });

      return {
        success: true,
        user: userAccount,
        mustChangePassword: false,
        fbUid: uid,
      };
    }

    return {
      success: false,
      error: 'User / U-Number not found. Please contact your Supervisor or Administrator.',
    };
  } catch (err: any) {
    console.error('Login error:', err);
    return {
      success: false,
      error: 'Authentication failed. Please verify your credentials.',
    };
  }
}

// Update Password in Firebase Auth and Firestore
export async function updateUserPasswordInFirebase(
  uNumber: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentFbUser = auth.currentUser;
    if (currentFbUser) {
      await fbUpdatePassword(currentFbUser, newPassword);

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentFbUser.uid), {
        is_first_login: false,
        updated_at: serverTimestamp(),
      });

      await logAuditEvent({
        actionType: 'PASSWORD_CHANGE',
        targetEntity: 'USER',
        targetId: currentFbUser.uid,
        details: { u_number: uNumber, note: 'User updated password via mandatory security update.' },
      });

      return { success: true };
    } else {
      // Find user doc by u_number
      const q = query(collection(db, 'users'), where('u_number', '==', uNumber));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          is_first_login: false,
          updated_at: serverTimestamp(),
        });
      }
      return { success: true };
    }
  } catch (err: any) {
    console.error('updateUserPasswordInFirebase error:', err);
    return { success: false, error: err.message || 'Failed to update password' };
  }
}

// Reset user password by Admin
export async function resetUserPasswordInFirebase(
  targetUNumber: string,
  adminUser: UserAccount
): Promise<boolean> {
  try {
    const email = uNumberToEmail(targetUNumber);
    
    // Find user doc
    const q = query(collection(db, 'users'), where('u_number', '==', targetUNumber));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        is_first_login: true, // Reset back to requiring password update
        updated_at: serverTimestamp(),
      });
    }

    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Email sending might be simulated or restricted on internal domains, continue gracefully
    }

    await logAuditEvent({
      actionType: 'PASSWORD_RESET',
      targetEntity: 'USER',
      targetId: targetUNumber,
      details: {
        target: targetUNumber,
        admin: adminUser.uNumber,
        note: `Reset password requirement for ${targetUNumber} back to initial U-Number.`,
      },
      actorUser: adminUser,
    });

    return true;
  } catch (err) {
    console.error('resetUserPasswordInFirebase error:', err);
    return false;
  }
}

// Fetch all users from Firestore
export async function fetchUsersFromFirestore(): Promise<UserAccount[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (snap.empty) {
      return DEFAULT_USERS;
    }
    const list: UserAccount[] = [];
    const seen = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() as FirestoreUserData;
      if (data && data.u_number) {
        const acc = firestoreUserToAccount(data, d.id);
        const key = acc.uNumber.trim().toLowerCase();
        if (!DEMO_USER_UNUMBERS.has(key) && !seen.has(key)) {
          seen.add(key);
          list.push(acc);
        }
      }
    });
    return list.length > 0 ? list : DEFAULT_USERS;
  } catch (err) {
    console.warn('fetchUsersFromFirestore fallback to default:', err);
    return DEFAULT_USERS;
  }
}

export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  try {
    console.log('Saving user to Firestore:', user.uNumber, user.name);
    if (!user.name) {
      console.error('CRITICAL: Attempting to save user with empty name:', user.uNumber);
      return;
    }
    const cleanUNum = user.uNumber.trim().toLowerCase();
    const uid = `u_${cleanUNum}`;
    const email = uNumberToEmail(user.uNumber);
    await setDoc(
      doc(db, 'users', uid),
      {
        u_number: user.uNumber,
        email: email,
        name: user.name,
        role: user.role,
        is_first_login: user.mustChangePassword || false,
        department: user.department || 'Ground Operations',
        password_hash: user.passwordHash || user.uNumber,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'users');
  }
}

export async function saveUsersToFirestoreBatch(users: UserAccount[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const user of users) {
      console.log('Batch saving user to Firestore:', user.uNumber, user.name);
      if (!user.name) {
        console.error('CRITICAL: Attempting to save batch user with empty name:', user.uNumber);
        continue;
      }
      const cleanUNum = user.uNumber.trim().toLowerCase();
      const uid = `u_${cleanUNum}`;
      const email = uNumberToEmail(user.uNumber);
      const userDocRef = doc(db, 'users', uid);
      batch.set(
        userDocRef,
        {
          u_number: user.uNumber,
          email: email,
          name: user.name,
          role: user.role,
          is_first_login: user.mustChangePassword || false,
          department: user.department || 'Ground Operations',
          password_hash: user.passwordHash || user.uNumber,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'users');
  }
}

// Delete User from Firestore
export async function deleteUserFromFirestore(uNumber: string): Promise<boolean> {
  try {
    const cleanUNum = uNumber.trim().toLowerCase();
    const uid = `u_${cleanUNum}`;
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await deleteDoc(userRef);
      return true;
    }
    const q = query(collection(db, 'users'), where('u_number', '==', uNumber));
    const querySnap = await getDocs(q);
    for (const d of querySnap.docs) {
      await deleteDoc(d.ref);
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'users');
    return false;
  }
}

// Real-time Users Subscription
export function subscribeToUsersFromFirestore(callback: (users: UserAccount[]) => void): () => void {
  const q = query(collection(db, 'users'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: UserAccount[] = [];
      const seen = new Set<string>();
      snapshot.docs.forEach((d) => {
        const data = d.data() as FirestoreUserData;
        if (data && data.u_number) {
          const acc = firestoreUserToAccount(data, d.id);
          const key = acc.uNumber.trim().toLowerCase();
          if (!DEMO_USER_UNUMBERS.has(key) && !seen.has(key)) {
            seen.add(key);
            list.push(acc);
          }
        }
      });
      if (list.length > 0) {
        callback(list);
      } else {
        callback(DEFAULT_USERS);
      }
    },
    (err) => {
      console.warn('subscribeToUsersFromFirestore warning:', err);
    }
  );
}

// ----------------- TEMPLATES ENGINE -----------------

export async function seedTemplatesIfMissing(): Promise<void> {
  try {
    const opGroupRef = doc(db, 'templates_op_groups', 'manifest');
    const manifestSnap = await getDoc(opGroupRef);
    if (!manifestSnap.exists()) {
      const defaultGroups = generateDefaultGroups();
      await setDoc(opGroupRef, {
        seeded_at: serverTimestamp(),
        total_groups: defaultGroups.length,
        groups: defaultGroups.map((g) => ({ id: g.id, name: g.name, code: g.code, isMandatory: g.isMandatory })),
      });
    }
  } catch (err) {
    console.warn('seedTemplatesIfMissing notice:', err);
  }
}

// ----------------- DAILY SHIFTS & EXECUTION IN FIRESTORE -----------------

export interface DailyShiftDoc {
  date: string;
  status: 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED';
  verified_by?: string;
  verified_at?: any;
  closed_by?: string;
  closed_at?: any;
  shift_notes?: string;
}

// Save Full Day Operational Data to Firestore
export async function saveDayDataToFirestore(
  dayData: DayOperationalData,
  actorUser?: UserAccount | null
): Promise<void> {
  try {
    const dateStr = dayData.date;
    const shiftRef = doc(db, 'daily_shifts', dateStr);

    const shiftStatus = dayData.isShiftClosed
      ? 'CLOSED'
      : dayData.groups.every((g) => g.isVerified)
      ? 'VERIFIED'
      : 'IN_PROGRESS';

    await setDoc(
      shiftRef,
      {
        date: dateStr,
        status: shiftStatus,
        verified_by: dayData.groups.find((g) => g.verifiedBy)?.verifiedBy || '',
        closed_by: dayData.closedBy || '',
        closed_at: dayData.closedAt || null,
        shift_notes: dayData.shiftNotes || '',
        last_updated: serverTimestamp(),
        raw_data: JSON.stringify(dayData),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('saveDayDataToFirestore error:', err);
  }
}

// Load Full Day Operational Data from Firestore or fallback to default template
export async function loadDayDataFromFirestore(dateStr: string): Promise<DayOperationalData> {
  try {
    const shiftRef = doc(db, 'daily_shifts', dateStr);
    const shiftSnap = await getDoc(shiftRef);

    const baseGroups = generateDefaultGroups();

    if (!shiftSnap.exists()) {
      const initialDay: DayOperationalData = {
        date: dateStr,
        groups: baseGroups,
        isShiftClosed: false,
        lastUpdated: new Date().toISOString(),
      };
      await saveDayDataToFirestore(initialDay);
      return initialDay;
    }

    const shiftData = shiftSnap.data();
    if (shiftData.raw_data) {
      try {
        const parsed = JSON.parse(shiftData.raw_data) as DayOperationalData;
        if (parsed && parsed.groups && parsed.groups.length > 0) {
          parsed.groups = cleanSampleSubGroups(parsed.groups);
          const defaults = generateDefaultGroups();
          let needsUpdate = false;
          parsed.groups = parsed.groups.map((g) => {
            if (!g.subGroups || g.subGroups.length === 0) {
              const match = defaults.find((d) => d.id === g.id || d.code === g.code);
              if (match && match.subGroups && match.subGroups.length > 0) {
                needsUpdate = true;
                return { ...g, subGroups: match.subGroups };
              }
            }
            return g;
          });
          if (needsUpdate) {
            saveDayDataToFirestore(parsed);
          }
          return parsed;
        }
      } catch (parseErr) {
        console.warn('Error parsing raw_data:', parseErr);
      }
    }

    return {
      date: dateStr,
      groups: baseGroups,
      isShiftClosed: shiftData.status === 'CLOSED',
      closedBy: shiftData.closed_by || undefined,
      closedAt: shiftData.closed_at || undefined,
      shiftNotes: shiftData.shift_notes || undefined,
      lastUpdated: shiftData.last_updated?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  } catch (err) {
    console.error('loadDayDataFromFirestore error, returning default:', err);
    return {
      date: dateStr,
      groups: generateDefaultGroups(),
      isShiftClosed: false,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ----------------- AUDIT LOGS SUBSCRIPTION -----------------

export function subscribeToAuditLogs(
  callback: (logs: AuditLogEntry[]) => void
): () => void {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLogEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        let detailsStr = '';
        if (typeof data.details === 'string') {
          detailsStr = data.details;
        } else if (data.details && typeof data.details === 'object') {
          detailsStr = data.details.message || JSON.stringify(data.details);
        }

        return {
          id: docSnap.id,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          dateTarget: data.date_scope || '',
          uNumber: data.actor_u_number || 'SYSTEM',
          userName: data.actor_name || 'Operator',
          userRole: data.actor_role || 'USER',
          action: data.action_type || 'AUDIT_EVENT',
          details: detailsStr,
        };
      });
      callback(logs);
    },
    (err) => {
      console.warn('Audit logs snapshot listener warning:', err);
    }
  );
}

// ----------------- REAL-TIME DAY DATA SUBSCRIPTION -----------------

export function subscribeToDayData(
  dateStr: string,
  callback: (data: DayOperationalData) => void
): () => void {
  const shiftRef = doc(db, 'daily_shifts', dateStr);

  return onSnapshot(
    shiftRef,
    (shiftSnap) => {
      if (shiftSnap.exists()) {
        const data = shiftSnap.data();
        if (data.raw_data) {
          try {
            const parsed = JSON.parse(data.raw_data) as DayOperationalData;
            if (parsed && parsed.groups && parsed.groups.length > 0) {
              parsed.groups = cleanSampleSubGroups(parsed.groups);
              callback(parsed);
              return;
            }
          } catch (err) {
            console.warn('Error parsing raw_data in snapshot:', err);
          }
        }
        loadDayDataFromFirestore(dateStr).then(callback);
      }
    },
    (err) => {
      console.warn('subscribeToDayData snapshot listener error:', err);
    }
  );
}
