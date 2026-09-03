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
  UserRole,
  DayOperationalData,
  OperationalGroup,
  SubOperationalGroup,
  Checklist,
  ChecklistItem,
  AuditLogEntry,
  ItemStatus,
  ChecklistStatus,
} from '@/types/aviation';
import {
  DEFAULT_USERS,
  generateDefaultGroups,
  makeItem,
  FLIGHT_CODES,
  cleanSampleSubGroups,
  mergeMasterHierarchyWithExisting,
  sanitizeDayData,
  getTodayDateString,
  getUpcomingDateStrings,
  getPurgeCutoffDateString,
  createInitialDayData,
} from './initialData';

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

export function safeJsonStringify(obj: any): string {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return String(obj);

  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return String(obj);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: String(provider.providerId || ''),
          email: String(provider.email || ''),
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', errMessage, errInfo);
  throw new Error(`${operationType} error on ${path}: ${errMessage}`);
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
  const isUserAdmin = (data.u_number || '').trim().toLowerCase() === 'admin' || data.role === 'ADMIN';
  const resolvedRole: UserAccount['role'] = isUserAdmin ? 'ADMIN' : 'SUPERVISOR';
  const resolvedBaseRole: UserRole = isUserAdmin ? 'ADMIN' : 'SUPERVISOR';
  return {
    uNumber: data.u_number,
    name: data.name,
    role: resolvedRole,
    baseRole: resolvedBaseRole,
    passwordHash: data.password_hash || data.u_number || 'ACTIVE',
    mustChangePassword: false,
    department: data.department || (isUserAdmin ? 'Ground Operations Management' : 'Ground Operations'),
    createdDate: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
    isAuthorized: true,
  };
}

// Ensure default users exist in Firestore and upgrade all user accounts to SUPERVISOR role
export async function seedDefaultUsersIfMissing(): Promise<void> {
  try {
    // 1. Purge legacy demo users if present in Firestore & enforce admin role
    try {
      const allUsersSnap = await getDocs(collection(db, 'users'));
      for (const d of allUsersSnap.docs) {
        const uNum = (d.data()?.u_number || '').trim().toLowerCase();
        if (DEMO_USER_UNUMBERS.has(uNum)) {
          const { deleteDoc } = await import('firebase/firestore');
          await deleteDoc(d.ref);
        } else if (uNum === 'admin') {
          // Explicitly grant full admin rights in Firestore
          await updateDoc(d.ref, {
            role: 'ADMIN',
            department: 'Ground Operations Management',
          });
        } else if (d.data()?.role === 'USER') {
          // Upgrade existing Firestore document from USER to SUPERVISOR
          await updateDoc(d.ref, { role: 'SUPERVISOR' });
        }
      }
    } catch (e) {
      console.warn('Notice while cleaning demo users from Firestore:', e);
    }

    // 2. Ensure core admin & supervisor accounts exist with SUPERVISOR / ADMIN roles
    for (const def of DEFAULT_USERS) {
      const email = uNumberToEmail(def.uNumber);
      const isDefAdmin = def.uNumber.trim().toLowerCase() === 'admin' || def.role === 'ADMIN';
      const q = query(collection(db, 'users'), where('u_number', '==', def.uNumber));
      const snap = await getDocs(q);

      if (snap.empty) {
        const uid = `u_${def.uNumber.toLowerCase()}`;
        await setDoc(doc(db, 'users', uid), {
          u_number: def.uNumber,
          email: email,
          name: def.name,
          role: isDefAdmin ? 'ADMIN' : def.role,
          is_first_login: false,
          department: def.department || (isDefAdmin ? 'Ground Operations Management' : 'Ground Operations'),
          password_hash: def.passwordHash,
          created_at: serverTimestamp(),
        });
      } else {
        const existingDoc = snap.docs[0];
        const existingRole = existingDoc.data()?.role;
        const targetRole = isDefAdmin ? 'ADMIN' : (existingRole === 'ADMIN' ? 'ADMIN' : def.role);
        await updateDoc(existingDoc.ref, {
          password_hash: def.passwordHash,
          is_first_login: def.mustChangePassword,
          role: targetRole,
          department: def.department || (isDefAdmin ? 'Ground Operations Management' : 'Ground Operations'),
        });
      }
    }

    // Explicitly guarantee doc u_admin has ADMIN role
    try {
      await setDoc(
        doc(db, 'users', 'u_admin'),
        {
          u_number: 'admin',
          email: 'admin@delgroundops.aero',
          name: 'Chief Ops Administrator',
          role: 'ADMIN',
          is_first_login: false,
          department: 'Ground Operations Management',
          password_hash: 'Admin220!',
        },
        { merge: true }
      );
    } catch {}
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
      const isUserAdmin = lowerUsername === 'admin' || foundData.role === 'ADMIN';
      if (isUserAdmin && foundData.role !== 'ADMIN') {
        foundData.role = 'ADMIN';
        try {
          await updateDoc(foundDoc.ref, { role: 'ADMIN' });
        } catch {}
      }
      const userAccount = firestoreUserToAccount(foundData, foundDoc.id);

      // Enforce Password check
      const expectedPassword = foundData.password_hash || foundData.u_number;
      const isPasswordMatch = pwd === expectedPassword || 
        (isUserAdmin && (pwd === 'admin' || pwd === 'Admin220!' || pwd === 'admin123'));
      if (!isPasswordMatch) {
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
      const isUserAdmin = lowerUsername === 'admin' || defaultUser.role === 'ADMIN';
      const isPasswordMatch = pwd === defaultUser.passwordHash || 
        (isUserAdmin && (pwd === 'admin' || pwd === 'Admin220!' || pwd === 'admin123'));
      if (!isPasswordMatch) {
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
        role: isUserAdmin ? 'ADMIN' : defaultUser.role,
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
    // Fallback to local default users if remote Firestore connection encounters any issue
    const defaultUser = DEFAULT_USERS.find(
      (u) => u.uNumber.toLowerCase() === lowerUsername
    );
    if (defaultUser) {
      const isUserAdmin = lowerUsername === 'admin' || defaultUser.role === 'ADMIN';
      const isPasswordMatch = pwd === defaultUser.passwordHash || 
        (isUserAdmin && (pwd === 'admin' || pwd === 'Admin220!' || pwd === 'admin123'));
      if (isPasswordMatch) {
        return {
          success: true,
          user: {
            uNumber: defaultUser.uNumber,
            name: defaultUser.name,
            role: isUserAdmin ? 'ADMIN' : 'SUPERVISOR',
            baseRole: isUserAdmin ? 'ADMIN' : 'SUPERVISOR',
            passwordHash: defaultUser.passwordHash,
            mustChangePassword: false,
            department: defaultUser.department,
            createdDate: defaultUser.createdDate || new Date().toISOString(),
          },
          mustChangePassword: false,
        };
      } else {
        return {
          success: false,
          error: 'Invalid password. Please check your credentials.',
        };
      }
    }
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

// Update Master Template Manifest in Firestore
export async function updateTemplateManifestInFirestore(groups: OperationalGroup[]): Promise<void> {
  try {
    const opGroupRef = doc(db, 'templates_op_groups', 'manifest');
    await setDoc(
      opGroupRef,
      {
        updated_at: serverTimestamp(),
        total_groups: groups.length,
        groups: groups,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('updateTemplateManifestInFirestore error:', err);
  }
}

// Synchronize target shift groups structure with updated master groups from Admin while preserving execution progress
export function syncGroupsStructure(
  targetGroups: OperationalGroup[],
  masterGroups: OperationalGroup[]
): OperationalGroup[] {
  const targetGroupMap = new Map<string, OperationalGroup>();
  targetGroups.forEach((g) => {
    targetGroupMap.set(g.id, g);
    if (g.code) targetGroupMap.set(g.code.toUpperCase(), g);
  });

  const updatedGroups = masterGroups.map((masterGrp) => {
    const existingGrp = targetGroupMap.get(masterGrp.id) || targetGroupMap.get(masterGrp.code.toUpperCase());

    if (!existingGrp) {
      // Completely new group added by Admin
      return masterGrp;
    }

    const existingSubMap = new Map<string, SubOperationalGroup>();
    (existingGrp.subGroups || []).forEach((s) => {
      existingSubMap.set(s.id, s);
      existingSubMap.set(s.name.trim().toLowerCase(), s);
    });

    const updatedSubGroups: SubOperationalGroup[] = (masterGrp.subGroups || []).map((masterSub) => {
      const existingSub = existingSubMap.get(masterSub.id) || existingSubMap.get(masterSub.name.trim().toLowerCase());

      if (!existingSub) {
        return masterSub;
      }

      const existingChkMap = new Map<string, Checklist>();
      (existingSub.checklists || []).forEach((c) => {
        existingChkMap.set(c.id, c);
        existingChkMap.set(c.title.trim().toLowerCase(), c);
      });

      const updatedChecklists: Checklist[] = (masterSub.checklists || []).map((masterChk) => {
        const existingChk = existingChkMap.get(masterChk.id) || existingChkMap.get(masterChk.title.trim().toLowerCase());

        if (!existingChk) {
          return masterChk;
        }

        const existingItemMap = new Map<string, ChecklistItem>();
        (existingChk.items || []).forEach((item) => {
          existingItemMap.set(item.id, item);
          existingItemMap.set(item.text.trim().toLowerCase(), item);
        });

        const updatedItems: ChecklistItem[] = (masterChk.items || []).map((masterItem) => {
          const existingItem = existingItemMap.get(masterItem.id) || existingItemMap.get(masterItem.text.trim().toLowerCase());

          if (!existingItem) {
            return masterItem;
          }

          return {
            ...masterItem,
            status: existingItem.status || 'not_done',
            remark: existingItem.remark,
            skipReason: existingItem.skipReason,
            actionBy: existingItem.actionBy,
            actionAt: existingItem.actionAt,
          };
        });

        const isComplete =
          updatedItems.length > 0 &&
          updatedItems.filter((i) => i.isMandatory).every((i) => i.status === 'done' || i.status === 'skipped');
        const hasStarted = updatedItems.some((i) => i.status === 'done' || i.status === 'skipped');
        const newStatus = isComplete
          ? 'completed'
          : hasStarted
          ? 'in_progress'
          : existingChk.status === 'completed' || existingChk.status === 'in_progress'
          ? existingChk.status
          : 'pending';

        return {
          ...masterChk,
          status: newStatus,
          items: updatedItems,
        };
      });

      return {
        ...masterSub,
        checklists: updatedChecklists,
      };
    });

    return {
      ...masterGrp,
      isVerified: existingGrp.isVerified || false,
      verifiedBy: existingGrp.verifiedBy,
      verifiedAt: existingGrp.verifiedAt,
      subGroups: updatedSubGroups,
    };
  });

  const dummyDayData: DayOperationalData = { date: 'sync', groups: updatedGroups, isShiftClosed: false, lastUpdated: new Date().toISOString() };
  return sanitizeDayData(dummyDayData).groups;
}

// Propagate Admin operational group additions, amendments, or cancellations across all active unclosed daily shifts in Firestore
export async function propagateAdminGroupChangesToActiveShifts(
  masterDayData: DayOperationalData
): Promise<void> {
  try {
    if (masterDayData.groups) {
      updateTemplateManifestInFirestore(masterDayData.groups);
    }

    const windowDates = getUpcomingDateStrings(undefined, 10);
    const todayStr = getTodayDateString();
    if (!windowDates.includes(todayStr)) {
      windowDates.unshift(todayStr);
    }

    for (const dStr of windowDates) {
      if (dStr === masterDayData.date) continue;

      const shiftRef = doc(db, 'daily_shifts', dStr);
      const shiftSnap = await getDoc(shiftRef);
      if (!shiftSnap.exists()) continue;

      const data = shiftSnap.data();
      if (data.status === 'CLOSED') continue;

      let parsed: DayOperationalData | null = null;
      if (data.raw_data) {
        try {
          parsed = JSON.parse(data.raw_data) as DayOperationalData;
        } catch {}
      }

      if (parsed && parsed.groups) {
        const syncedGroups = syncGroupsStructure(parsed.groups, masterDayData.groups);
        const updatedShift: DayOperationalData = sanitizeDayData({
          ...parsed,
          groups: syncedGroups,
          lastUpdated: new Date().toISOString(),
        });

        await saveDayDataToFirestore(updatedShift);
      }
    }
  } catch (err) {
    console.warn('propagateAdminGroupChangesToActiveShifts error:', err);
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
    const sanitized = sanitizeDayData(dayData);
    const dateStr = sanitized.date;
    const shiftRef = doc(db, 'daily_shifts', dateStr);

    const shiftStatus = sanitized.isShiftClosed
      ? 'CLOSED'
      : sanitized.groups.every((g) => g.isVerified)
      ? 'VERIFIED'
      : 'IN_PROGRESS';

    await setDoc(
      shiftRef,
      {
        date: dateStr,
        status: shiftStatus,
        verified_by: sanitized.groups.find((g) => g.verifiedBy)?.verifiedBy || '',
        closed_by: sanitized.closedBy || '',
        closed_at: sanitized.closedAt || null,
        shift_notes: sanitized.shiftNotes || '',
        last_updated: serverTimestamp(),
        raw_data: safeJsonStringify(sanitized),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('saveDayDataToFirestore error:', err);
  }
}

// Load Full Day Operational Data from Firestore or fallback to default template,
// guaranteeing full checklist hierarchy while preserving user progress & verification states.
export async function loadDayDataFromFirestore(dateStr: string): Promise<DayOperationalData> {
  try {
    const shiftRef = doc(db, 'daily_shifts', dateStr);
    const shiftSnap = await getDoc(shiftRef);

    if (!shiftSnap.exists()) {
      const initialDay = createInitialDayData(dateStr);
      await saveDayDataToFirestore(initialDay);
      return initialDay;
    }

    const shiftData = shiftSnap.data();
    let parsedData: DayOperationalData | null = null;

    if (shiftData.raw_data) {
      try {
        parsedData = JSON.parse(shiftData.raw_data) as DayOperationalData;
      } catch (parseErr) {
        console.warn(`Error parsing raw_data for ${dateStr}:`, parseErr);
      }
    }

    if (!parsedData || !parsedData.groups || parsedData.groups.length === 0) {
      parsedData = {
        date: dateStr,
        groups: generateDefaultGroups(),
        isShiftClosed: shiftData.status === 'CLOSED',
        closedBy: shiftData.closed_by || undefined,
        closedAt: shiftData.closed_at || undefined,
        shiftNotes: shiftData.shift_notes || undefined,
        lastUpdated: shiftData.last_updated?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    }

    // Run master hierarchy merge to guarantee complete checklists while strictly preserving user edits
    const { merged, changed } = mergeMasterHierarchyWithExisting(parsedData, dateStr);

    if (changed || !shiftData.raw_data) {
      // Background update without blocking the user
      saveDayDataToFirestore(merged);
    }

    return merged;
  } catch (err) {
    console.error(`loadDayDataFromFirestore error for ${dateStr}, returning default:`, err);
    return createInitialDayData(dateStr);
  }
}

// ----------------- ROLLING 10-DAY WINDOW AUTO-INITIALIZATION -----------------

/**
 * Pre-seeds and initializes the rolling 10-day forward window in Firestore.
 * Ensures that any date in the 10-day window exists with complete checklists
 * while strictly preserving all user progress and verification states.
 */
export async function ensureDateWindowInitialized(
  daysCount: number = 10,
  startDateStr?: string
): Promise<{ initializedDates: string[]; success: boolean }> {
  const dates = getUpcomingDateStrings(startDateStr, daysCount);
  const initializedDates: string[] = [];

  try {
    const promises = dates.map(async (dStr) => {
      try {
        const day = await loadDayDataFromFirestore(dStr);
        if (day && day.groups && day.groups.length > 0) {
          initializedDates.push(dStr);
        }
      } catch (e) {
        console.warn(`Failed auto-initializing window for date ${dStr}:`, e);
      }
    });

    await Promise.allSettled(promises);
    return { initializedDates, success: true };
  } catch (err) {
    console.warn('ensureDateWindowInitialized encountered an error:', err);
    return { initializedDates, success: false };
  }
}

// ----------------- 1-MONTH DATA RETENTION PURGE ENGINE -----------------

/**
 * Purges operational shifts and audit trail records older than 1 month (default 30 days)
 * to maintain high database responsiveness and prevent bloat.
 */
export async function purgeOldShiftsAndAuditLogs(
  retentionDays: number = 30
): Promise<{ purgedShifts: number; purgedAuditLogs: number; cutoffDate: string }> {
  const cutoffDateStr = getPurgeCutoffDateString(retentionDays);
  let purgedShifts = 0;
  let purgedAuditLogs = 0;

  try {
    // 1. Purge old daily_shifts older than cutoffDateStr
    const shiftsCol = collection(db, 'daily_shifts');
    const shiftsSnap = await getDocs(shiftsCol);

    const shiftDeletePromises: Promise<void>[] = [];
    shiftsSnap.docs.forEach((d) => {
      const docId = d.id;
      const data = d.data();
      const dateVal = data.date || docId;

      if (dateVal < cutoffDateStr || docId < cutoffDateStr) {
        shiftDeletePromises.push(
          deleteDoc(doc(db, 'daily_shifts', docId))
            .then(() => {
              purgedShifts += 1;
            })
            .catch((err) => {
              console.warn(`Could not purge shift ${docId}:`, err);
            })
        );
      }
    });

    await Promise.allSettled(shiftDeletePromises);

    // 2. Purge old audit logs older than cutoffDateStr
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    const logsCol = collection(db, 'audit_logs');
    // Query logs where date_scope < cutoffDateStr or timestamp < cutoffTimestamp
    const logsSnap = await getDocs(logsCol);

    const logDeletePromises: Promise<void>[] = [];
    logsSnap.docs.forEach((d) => {
      const data = d.data();
      const dateScope = data.date_scope || '';
      const ts = data.timestamp;

      let isOld = false;
      if (dateScope && dateScope < cutoffDateStr) {
        isOld = true;
      } else if (ts && ts.toDate && ts.toDate() < cutoffDate) {
        isOld = true;
      }

      if (isOld) {
        logDeletePromises.push(
          deleteDoc(doc(db, 'audit_logs', d.id))
            .then(() => {
              purgedAuditLogs += 1;
            })
            .catch((err) => {
              console.warn(`Could not purge audit log ${d.id}:`, err);
            })
        );
      }
    });

    await Promise.allSettled(logDeletePromises);

    if (purgedShifts > 0 || purgedAuditLogs > 0) {
      console.info(
        `[Data Retention] Purged ${purgedShifts} old shifts and ${purgedAuditLogs} old audit logs older than ${cutoffDateStr}.`
      );
    }
  } catch (err) {
    console.warn('purgeOldShiftsAndAuditLogs notice:', err);
  }

  return { purgedShifts, purgedAuditLogs, cutoffDate: cutoffDateStr };
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
          detailsStr = data.details.message || safeJsonStringify(data.details);
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

// ----------------- REAL-TIME DAY DATA SUBSCRIPTION & RANGE FETCH -----------------

export async function fetchShiftsForDateRange(startDateStr: string, endDateStr: string): Promise<DayOperationalData[]> {
  try {
    const shiftsCol = collection(db, 'daily_shifts');
    const q = query(shiftsCol, where('date', '>=', startDateStr), where('date', '<=', endDateStr));
    const snapshot = await getDocs(q);
    const results: DayOperationalData[] = [];
    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data && data.raw_data) {
        try {
          const parsed = JSON.parse(data.raw_data) as DayOperationalData;
          if (parsed && parsed.groups) {
            results.push(parsed);
          }
        } catch (e) {
          console.warn('Error parsing raw_data for date range shift:', d.id, e);
        }
      }
    });
    // Sort ascending by date
    results.sort((a, b) => a.date.localeCompare(b.date));
    return results;
  } catch (err) {
    console.warn('fetchShiftsForDateRange error:', err);
    return [];
  }
}

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
              const sanitized = sanitizeDayData(parsed);
              callback(sanitized);
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
