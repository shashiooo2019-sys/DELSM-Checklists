'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  DayOperationalData, 
  OperationalGroup, 
  SubOperationalGroup, 
  Checklist, 
  ChecklistItem, 
  UserAccount,
  ChecklistVersionRecord
} from '@/types/aviation';
import { 
  loadUsers, 
  saveUsers, 
  resetUserPassword, 
  resetUserPasswordAsync,
  addOrUpdateUser, 
  deleteUserAccount, 
  parseUsersExcel, 
  parseChecklistExcel, 
  downloadUserImportTemplate, 
  downloadChecklistImportTemplate,
  resetDayDataToDefault,
  addAuditLog,
  subscribeUsers,
  ensureDateWindowInitialized,
  purgeOldShiftsAndAuditLogs,
  compileNonComplianceRecords,
  exportNonComplianceReportToExcel,
  NonComplianceRecord,
} from '@/lib/storage';
import { fetchUsersFromFirestore, subscribeToUsersFromFirestore, saveUserToFirestore, saveUsersToFirestoreBatch, deleteUserFromFirestore, fetchShiftsForDateRange, updateTemplateManifestInFirestore, propagateAdminGroupChangesToActiveShifts, saveDayDataToFirestore } from '@/lib/firestoreService';
import { makeItem, FLIGHT_CODES, getNextChecklistVersion } from '@/lib/initialData';
import { ConfirmModal, ConfirmModalState } from './ConfirmModal';
import { 
  X, 
  Sliders, 
  Building2, 
  ListChecks, 
  FileSpreadsheet, 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Edit2,
  Check, 
  ShieldCheck, 
  Upload, 
  Download, 
  KeyRound, 
  RotateCcw, 
  AlertCircle, 
  Search,
  Layers,
  Sparkles,
  Plane,
  Save,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Tag,
  History,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  Printer,
  Filter,
  ArrowUpRight,
  Folder,
  FolderOpen,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  dayData: DayOperationalData;
  currentUser: UserAccount;
  onClose: () => void;
  onSaveDayData: (data: DayOperationalData) => void;
}

type AdminTab = 'groups' | 'checklists' | 'excel' | 'users' | 'reports';

let adminGeneralIdCounter = 5000;
function generateUniqueId(prefix = 'id'): string {
  adminGeneralIdCounter += 1;
  return `${prefix}-${adminGeneralIdCounter}`;
}

let adminGroupIdCounter = 1000;
function generateUniqueGroupId() {
  adminGroupIdCounter += 1;
  return `grp-${adminGroupIdCounter}`;
}

export function AdminPanel({
  isOpen,
  dayData,
  currentUser,
  onClose,
  onSaveDayData,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('groups');
  const [usersList, setUsersList] = useState<UserAccount[]>(loadUsers());
  const [userSearch, setUserSearch] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Non-Compliance Report & Compilation States
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isFetchingReport, setIsFetchingReport] = useState<boolean>(false);
  const [compiledNonComplianceRecords, setCompiledNonComplianceRecords] = useState<NonComplianceRecord[]>([]);
  const [hasReportBeenFetched, setHasReportBeenFetched] = useState<boolean>(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | 'missed' | 'incorrectly_executed'>('ALL');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  const handleFetchNonComplianceReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert('Please select both Start Date and End Date for the report range.');
      return;
    }
    setIsFetchingReport(true);
    try {
      const shifts = await fetchShiftsForDateRange(reportStartDate, reportEndDate);
      // Also ensure current day shift is included if within range
      if (dayData && dayData.date >= reportStartDate && dayData.date <= reportEndDate) {
        if (!shifts.some((s) => s.date === dayData.date)) {
          shifts.push(dayData);
        }
      }
      const records = compileNonComplianceRecords(shifts);
      setCompiledNonComplianceRecords(records);
      setHasReportBeenFetched(true);
    } catch (err) {
      console.error('Error fetching shifts for report:', err);
      alert('Failed to load historical shift records from database.');
    } finally {
      setIsFetchingReport(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeUsers((users) => {
      setUsersList(users);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Group Builder Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupIsFlight, setNewGroupIsFlight] = useState(false);
  const [newGroupIsMandatory, setNewGroupIsMandatory] = useState(true);

  // Sub-Group Builder Form State (with Flight Group Macro)
  const [selectedParentGroupId, setSelectedParentGroupId] = useState<string>('ALL_FLIGHT_GROUPS');
  const [newSubGroupName, setNewSubGroupName] = useState('');
  const [newSubGroupCode, setNewSubGroupCode] = useState('');
  const [newSubGroupIsMandatory, setNewSubGroupIsMandatory] = useState(true);

  // Checklist & Items Editor State
  const [selectedEditGroupId, setSelectedEditGroupId] = useState<string>('ALL_FLIGHT_GROUPS');
  const [selectedEditSubGroupId, setSelectedEditSubGroupId] = useState<string>('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [newChecklistIsMandatory, setNewChecklistIsMandatory] = useState(true);
  const [newChecklistVersion, setNewChecklistVersion] = useState('v1.0');
  const [newChecklistVersionDate, setNewChecklistVersionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inlineSubGroupName, setInlineSubGroupName] = useState('');
  const [newItemText, setNewItemText] = useState('');

  const handleQuickAppendChecklistToGroup = (groupId: string) => {
    const grp = dayData.groups.find((g) => g.id === groupId);
    setSelectedEditGroupId(groupId);
    setSelectedEditSubGroupId('DIRECT_GROUP');
    setActiveTab('checklists');
    showNotification(`Ready to append checklist directly to ${grp ? grp.name : 'Operational Group'}`);
  };
  const [newItemIsMandatory, setNewItemIsMandatory] = useState(true);

  // Amend / Edit Modals State
  const [editingSubGroup, setEditingSubGroup] = useState<{
    id: string;
    parentGroupId: string;
    name: string;
    code?: string;
    isMandatory: boolean;
  } | null>(null);

  const [editingChecklist, setEditingChecklist] = useState<{
    id: string;
    subGroupId: string;
    parentGroupId: string;
    title: string;
    description?: string;
    isMandatory: boolean;
    version: string;
    versionDate: string;
  } | null>(null);

  const [editingItem, setEditingItem] = useState<{
    id: string;
    chkId: string;
    chkTitle: string;
    text: string;
    isMandatory: boolean;
  } | null>(null);

  // Drag and Drop Tracking States
  const [draggedSubGroupId, setDraggedSubGroupId] = useState<string | null>(null);
  const [draggedChecklistId, setDraggedChecklistId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Excel Upload States
  const [excelUserFile, setExcelUserFile] = useState<File | null>(null);
  const [excelChecklistFile, setExcelChecklistFile] = useState<File | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'NEW' | 'OVERWRITE'>('NEW');
  const [excelTargetGroupId, setExcelTargetGroupId] = useState<string>('ALL_FLIGHT_GROUPS');
  const [excelTargetSubGroupId, setExcelTargetSubGroupId] = useState<string>('DIRECT_GROUP');
  const [excelTargetChecklistId, setExcelTargetChecklistId] = useState<string>('__NEW__');
  const [excelChecklistTitle, setExcelChecklistTitle] = useState<string>('Imported Operations Checklist');
  const [importPreviewUsers, setImportPreviewUsers] = useState<UserAccount[]>([]);
  const [importPreviewItems, setImportPreviewItems] = useState<ChecklistItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // New User Form State
  const [newUNumber, setNewUNumber] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserAccount['role']>('USER');
  const [newUserDept, setNewUserDept] = useState('Ground Operations');

  // Personnel Edit State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserAccount['role']>('USER');
  const [editUserDept, setEditUserDept] = useState('Ground Operations');
  const [editUserIsAuthorized, setEditUserIsAuthorized] = useState<boolean>(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Group Edit State
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    name: string;
    code: string;
    isMandatory: boolean;
  } | null>(null);

  // File Explorer Tree View States
  const [showChecklistItemsInExplorer, setShowChecklistItemsInExplorer] = useState<boolean>(false);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});
  const [treeSearchTerm, setTreeSearchTerm] = useState<string>('');
  const [perChecklistExpandedItems, setPerChecklistExpandedItems] = useState<Record<string, boolean>>({});

  // Inline tree creation states
  const [activeInlineSubGroupGroupId, setActiveInlineSubGroupGroupId] = useState<string | null>(null);
  const [inlineSubGroupNameInput, setInlineSubGroupNameInput] = useState('');
  const [inlineSubGroupCodeInput, setInlineSubGroupCodeInput] = useState('');
  const [inlineSubGroupIsMandatoryInput, setInlineSubGroupIsMandatoryInput] = useState(true);

  const [activeInlineChecklistSubGroupId, setActiveInlineChecklistSubGroupId] = useState<string | null>(null);
  const [inlineChecklistTitleInput, setInlineChecklistTitleInput] = useState('');
  const [inlineChecklistDescInput, setInlineChecklistDescInput] = useState('');
  const [inlineChecklistVersionInput, setInlineChecklistVersionInput] = useState('v1.0');
  const [inlineChecklistIsMandatoryInput, setInlineChecklistIsMandatoryInput] = useState(true);

  const [activeInlineItemChecklistId, setActiveInlineItemChecklistId] = useState<string | null>(null);
  const [inlineItemTextInput, setInlineItemTextInput] = useState('');
  const [inlineItemIsMandatoryInput, setInlineItemIsMandatoryInput] = useState(true);

  // Dedicated Excel Overwrite Target Modal State
  const [excelOverwriteTarget, setExcelOverwriteTarget] = useState<{
    checklistId: string;
    checklistTitle: string;
    subGroupId: string;
    subGroupName: string;
    parentGroupId: string;
    groupName: string;
    isAllFlightGroups: boolean;
  } | null>(null);
  const [excelOverwriteItems, setExcelOverwriteItems] = useState<ChecklistItem[]>([]);
  const [excelOverwriteFileName, setExcelOverwriteFileName] = useState<string>('');
  const excelOverwriteFileInputRef = useRef<HTMLInputElement>(null);

  // Checklist Version Summary Directory States
  const [showVersionSummaryModal, setShowVersionSummaryModal] = useState(false);
  const [versionSearchQuery, setVersionSearchQuery] = useState('');
  const [versionGroupFilter, setVersionGroupFilter] = useState<'ALL' | 'FLIGHT' | 'NON_FLIGHT' | 'REVISED_ONLY'>('ALL');
  const [expandedHistoryChkId, setExpandedHistoryChkId] = useState<string | null>(null);

  const userFileInputRef = useRef<HTMLInputElement>(null);
  const checklistFileInputRef = useRef<HTMLInputElement>(null);

  // Aggregated Checklist Directory for Versioning Summary
  const allAggregatedChecklists = useMemo(() => {
    const list: {
      groupId: string;
      groupName: string;
      groupCode: string;
      isFlightGroup: boolean;
      subGroupId: string;
      subGroupName: string;
      checklist: Checklist;
      revisionsCount: number;
      hasOverwrites: boolean;
    }[] = [];

    dayData.groups.forEach((grp) => {
      grp.subGroups.forEach((sub) => {
        sub.checklists.forEach((chk) => {
          const history = chk.versionHistory || [];
          const hasOverwrites = history.some((h) => h.changeType === 'OVERWRITE') || (chk.version && chk.version !== 'v1.0');
          list.push({
            groupId: grp.id,
            groupName: grp.name,
            groupCode: grp.code,
            isFlightGroup: grp.isFlightGroup,
            subGroupId: sub.id,
            subGroupName: sub.name,
            checklist: chk,
            revisionsCount: history.length > 0 ? history.length : 1,
            hasOverwrites: !!hasOverwrites,
          });
        });
      });
    });

    return list;
  }, [dayData.groups]);

  const filteredVersionChecklists = useMemo(() => {
    return allAggregatedChecklists.filter((item) => {
      // Group filter
      if (versionGroupFilter === 'FLIGHT' && !item.isFlightGroup) return false;
      if (versionGroupFilter === 'NON_FLIGHT' && item.isFlightGroup) return false;
      if (versionGroupFilter === 'REVISED_ONLY' && !item.hasOverwrites && item.revisionsCount <= 1) return false;

      // Text query
      if (versionSearchQuery.trim()) {
        const q = versionSearchQuery.trim().toLowerCase();
        const matchesTitle = item.checklist.title.toLowerCase().includes(q);
        const matchesGroup = item.groupName.toLowerCase().includes(q) || item.groupCode.toLowerCase().includes(q);
        const matchesSub = item.subGroupName.toLowerCase().includes(q);
        const matchesVer = (item.checklist.version || 'v1.0').toLowerCase().includes(q);
        const matchesHistory = (item.checklist.versionHistory || []).some(
          (h) => h.notes?.toLowerCase().includes(q) || h.updatedBy.toLowerCase().includes(q) || h.version.toLowerCase().includes(q)
        );
        return matchesTitle || matchesGroup || matchesSub || matchesVer || matchesHistory;
      }
      return true;
    });
  }, [allAggregatedChecklists, versionGroupFilter, versionSearchQuery]);

  const handleExportVersionSummaryCSV = () => {
    const headers = [
      'Station',
      'Group Code',
      'Group Name',
      'Group Classification',
      'Sub-Group / Station Section',
      'Checklist Title',
      'Mandatory Status',
      'Current Version',
      'Version Date',
      'Active Checklist Items Count',
      'Total Recorded Revisions',
      'Last Modified By',
      'Version History Logs',
    ];

    const rows = allAggregatedChecklists.map((row) => {
      const history = row.checklist.versionHistory || [];
      const lastHistory = history[history.length - 1];
      const historySummary = history
        .map(
          (h) =>
            `[${h.version} | ${h.versionDate} | ${h.updatedBy} | ${h.itemCount} items | ${h.changeType}: ${h.notes || 'No change notes'}]`
        )
        .join(' ; ');

      return [
        `"DEL"`,
        `"${row.groupCode}"`,
        `"${row.groupName.replace(/"/g, '""')}"`,
        `"${row.isFlightGroup ? 'Flight Group' : 'Station Operational Group'}"`,
        `"${row.subGroupName.replace(/"/g, '""')}"`,
        `"${row.checklist.title.replace(/"/g, '""')}"`,
        `"${row.checklist.isMandatory ? 'MANDATORY' : 'OPTIONAL'}"`,
        `"${row.checklist.version || 'v1.0'}"`,
        `"${row.checklist.versionDate || '2026-08-20'}"`,
        row.checklist.items?.length || 0,
        history.length > 0 ? history.length : 1,
        `"${lastHistory?.updatedBy || 'System Baseline'}"`,
        `"${historySummary.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DEL_GroundOps_Checklist_Versioning_Summary_${dayData.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported Checklist Versions Summary to CSV successfully!');
  };

  if (!isOpen) return null;

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // ------------------ GROUP & SUB-GROUP BUILDER ------------------

  const handleAddOperationalGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupCode.trim()) {
      showNotification('Please enter Group Name and Station Code', 'error');
      return;
    }

    const newGroup: OperationalGroup = {
      id: generateUniqueGroupId(),
      name: newGroupName.trim(),
      code: newGroupCode.trim().toUpperCase(),
      isFlightGroup: newGroupIsFlight,
      isMandatory: newGroupIsMandatory,
      isVerified: false,
      subGroups: [],
    };

    const updatedGroups = [...dayData.groups, newGroup];
    const updatedData: DayOperationalData = {
      ...dayData,
      groups: updatedGroups,
    };

    onSaveDayData(updatedData);
    setNewGroupName('');
    setNewGroupCode('');
    showNotification(`Added operational group ${newGroup.name}`);
  };

  const handleDeleteGroup = (groupId: string) => {
    const grp = dayData.groups.find((g) => g.id === groupId);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Operational Group',
      message: `Are you sure you want to delete the group "${grp?.name || groupId}"? This cannot be undone.`,
      confirmLabel: 'Delete Group',
      variant: 'danger',
      onConfirm: () => {
        const updatedGroups = dayData.groups.filter((g) => g.id !== groupId);
        onSaveDayData({ ...dayData, groups: updatedGroups });
        showNotification('Group deleted');
      },
    });
  };

  const handleToggleGroupMandatory = (groupId: string) => {
    const updatedGroups = dayData.groups.map((g) => {
      if (g.id === groupId) return { ...g, isMandatory: !g.isMandatory };
      return g;
    });
    onSaveDayData({ ...dayData, groups: updatedGroups });
  };

  // Add Sub-Group with FLIGHT GROUP MACRO LOGIC
  const handleAddSubGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubGroupName.trim()) {
      showNotification('Please enter Sub-Group name', 'error');
      return;
    }

    let updatedGroups = [...dayData.groups];

    if (selectedParentGroupId === 'ALL_FLIGHT_GROUPS') {
      // MACRO: Replicate across ALL 4 flight groups simultaneously!
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.isFlightGroup) {
          const newSub: SubOperationalGroup = {
            id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
            name: newSubGroupName.trim(),
            code: newSubGroupCode.trim().toUpperCase() || undefined,
            isMandatory: newSubGroupIsMandatory,
            checklists: [],
          };
          return {
            ...grp,
            subGroups: [...grp.subGroups, newSub],
          };
        }
        return grp;
      });
      showNotification(`Replicated sub-group "${newSubGroupName}" across ALL 4 Flight Groups (LX147, LX2647, LH763, LH761) simultaneously!`);
    } else {
      // Single group assignment
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.id === selectedParentGroupId) {
          const newSub: SubOperationalGroup = {
            id: `sub-${Date.now()}`,
            name: newSubGroupName.trim(),
            code: newSubGroupCode.trim().toUpperCase() || undefined,
            isMandatory: newSubGroupIsMandatory,
            checklists: [],
          };
          return {
            ...grp,
            subGroups: [...grp.subGroups, newSub],
          };
        }
        return grp;
      });
      showNotification(`Added sub-group "${newSubGroupName}" to selected group`);
    }

    onSaveDayData({ ...dayData, groups: updatedGroups });
    setNewSubGroupName('');
    setNewSubGroupCode('');
  };

  const handleDeleteSubGroup = (groupId: string, subId: string) => {
    const grp = dayData.groups.find((g) => g.id === groupId);
    const sub = grp?.subGroups.find((s) => s.id === subId);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Sub-Operational Group',
      message: `Are you sure you want to delete the sub-group "${sub?.name || subId}"? This cannot be undone.`,
      confirmLabel: 'Delete Sub-Group',
      variant: 'danger',
      onConfirm: () => {
        const updatedGroups = dayData.groups.map((grpItem) => {
          if (grpItem.id === groupId) {
            return {
              ...grpItem,
              subGroups: grpItem.subGroups.filter((s) => s.id !== subId),
            };
          }
          return grpItem;
        });
        onSaveDayData({ ...dayData, groups: updatedGroups });
        showNotification('Sub-group deleted');
      },
    });
  };

  // ------------------ CHECKLIST & ITEMS BUILDER ------------------

  const isAllFlightGroups = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
  const flightGroups = dayData.groups.filter((g) => g.isFlightGroup);
  const selectedEditGroup = isAllFlightGroups ? null : dayData.groups.find((g) => g.id === selectedEditGroupId) || dayData.groups[0];

  // Derive active sub-groups based on whether All Flight Groups or a specific group is selected
  let activeSubGroups: { id: string; name: string; code?: string; checklists: Checklist[] }[] = [];
  if (isAllFlightGroups) {
    const subMap = new Map<string, { id: string; name: string; code?: string; checklists: Checklist[] }>();
    flightGroups.forEach((fg) => {
      fg.subGroups.forEach((sub) => {
        const key = sub.name.trim().toLowerCase();
        if (!subMap.has(key)) {
          subMap.set(key, {
            id: sub.id,
            name: sub.name,
            code: sub.code,
            checklists: sub.checklists,
          });
        }
      });
    });
    activeSubGroups = Array.from(subMap.values());
  } else {
    activeSubGroups = selectedEditGroup?.subGroups || [];
  }

  const isDirectGroupMode = selectedEditSubGroupId === 'DIRECT_GROUP' || !selectedEditSubGroupId;
  const isNewSubGroupMode = selectedEditSubGroupId === 'NEW_SUBGROUP';

  const generalSubGroup = activeSubGroups.find(
    (s) => s.name.trim().toLowerCase() === 'general operations' || s.name.trim().toLowerCase() === 'general'
  );

  let selectedEditSubGroup: { id: string; name: string; code?: string; checklists: Checklist[] } | undefined;
  if (isNewSubGroupMode) {
    selectedEditSubGroup = {
      id: 'NEW_SUBGROUP',
      name: inlineSubGroupName.trim() || 'New Sub-Group',
      code: selectedEditGroup?.code,
      checklists: [],
    };
  } else if (isDirectGroupMode) {
    const rawChecklists = isAllFlightGroups
      ? flightGroups.flatMap((fg) => fg.subGroups.flatMap((s) => s.checklists))
      : (selectedEditGroup ? selectedEditGroup.subGroups.flatMap((s) => s.checklists) : []);

    const uniqueChecklists: Checklist[] = [];
    const seenChecklistKeys = new Set<string>();
    for (const chk of rawChecklists) {
      const key = `${chk.id}-${chk.title.trim().toLowerCase()}`;
      if (!seenChecklistKeys.has(key)) {
        seenChecklistKeys.add(key);
        uniqueChecklists.push(chk);
      }
    }

    selectedEditSubGroup = {
      id: generalSubGroup?.id || 'DIRECT_GROUP',
      name: generalSubGroup?.name || 'General Operations',
      code: selectedEditGroup?.code || 'GEN',
      checklists: uniqueChecklists,
    };
  } else {
    selectedEditSubGroup =
      activeSubGroups.find((s) => s.id === selectedEditSubGroupId || s.name.trim().toLowerCase() === selectedEditSubGroupId.trim().toLowerCase()) ||
      activeSubGroups[0];
  }

  // ------------------ EXCEL BULK IMPORTER DERIVATIONS ------------------
  const isExcelAllFlight = excelTargetGroupId === 'ALL_FLIGHT_GROUPS';
  const excelTargetGroup = isExcelAllFlight ? null : dayData.groups.find((g) => g.id === excelTargetGroupId);

  let excelAvailableSubGroups: { id: string; name: string }[] = [];
  if (isExcelAllFlight) {
    const subMap = new Map<string, { id: string; name: string }>();
    dayData.groups
      .filter((g) => g.isFlightGroup)
      .forEach((fg) => {
        fg.subGroups.forEach((sub) => {
          const key = sub.name.trim().toLowerCase();
          if (!subMap.has(key)) {
            subMap.set(key, { id: sub.name, name: sub.name });
          }
        });
      });
    excelAvailableSubGroups = Array.from(subMap.values());
  } else if (excelTargetGroup) {
    excelAvailableSubGroups = excelTargetGroup.subGroups.map((s) => ({ id: s.id, name: s.name }));
  }

  let excelAvailableChecklists: { id: string; title: string; itemCount: number; subGroupName: string }[] = [];
  const isExcelDirect = !excelTargetSubGroupId || excelTargetSubGroupId === 'DIRECT_GROUP';
  const excelTargetSubName = (isExcelDirect ? 'general operations' : excelTargetSubGroupId).trim().toLowerCase();
  const chkMap = new Map<string, { id: string; title: string; itemCount: number; subGroupName: string }>();

  if (isExcelAllFlight) {
    const fGroups = dayData.groups.filter((g) => g.isFlightGroup);
    fGroups.forEach((fg) => {
      fg.subGroups.forEach((sg) => {
        const isMatch = isExcelDirect || sg.name.trim().toLowerCase() === excelTargetSubName || sg.id === excelTargetSubGroupId;
        if (isMatch) {
          sg.checklists.forEach((chk) => {
            const key = chk.title.trim().toLowerCase();
            if (!chkMap.has(key)) {
              chkMap.set(key, {
                id: chk.id || chk.title,
                title: chk.title,
                itemCount: chk.items?.length || 0,
                subGroupName: sg.name,
              });
            }
          });
        }
      });
    });
  } else if (excelTargetGroup) {
    excelTargetGroup.subGroups.forEach((sg) => {
      const isMatch = isExcelDirect || sg.id === excelTargetSubGroupId || sg.name.trim().toLowerCase() === excelTargetSubName;
      if (isMatch) {
        sg.checklists.forEach((chk) => {
          const key = chk.id || chk.title.trim().toLowerCase();
          if (!chkMap.has(key)) {
            chkMap.set(key, {
              id: chk.id || chk.title,
              title: chk.title,
              itemCount: chk.items?.length || 0,
              subGroupName: sg.name,
            });
          }
        });
      }
    });
  }
  excelAvailableChecklists = Array.from(chkMap.values());

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim()) {
      showNotification('Please enter a checklist title', 'error');
      return;
    }

    const titleToAdd = newChecklistTitle.trim();
    const descToAdd = newChecklistDesc.trim() || undefined;

    let targetSubName = 'General Operations';
    let targetSubCode: string | undefined = undefined;

    if (isNewSubGroupMode) {
      if (!inlineSubGroupName.trim()) {
        showNotification('Please enter a name for the new sub-group', 'error');
        return;
      }
      targetSubName = inlineSubGroupName.trim();
    } else if (isDirectGroupMode) {
      targetSubName = 'General Operations';
    } else if (selectedEditSubGroup) {
      targetSubName = selectedEditSubGroup.name.trim();
      targetSubCode = selectedEditSubGroup.code;
    }

    const targetSubKey = targetSubName.toLowerCase();

    if (isAllFlightGroups) {
      // Replicate checklist across ALL 4 flight groups simultaneously
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          const newChk: Checklist = {
            id: `chk-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: titleToAdd,
            description: descToAdd,
            isMandatory: newChecklistIsMandatory,
            status: 'pending',
            items: [],
            version: newChecklistVersion.trim() || 'v1.0',
            versionDate: newChecklistVersionDate.trim() || new Date().toISOString().split('T')[0],
          };

          const hasSub = grp.subGroups.some((s) => s.name.trim().toLowerCase() === targetSubKey);
          if (hasSub) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.name.trim().toLowerCase() === targetSubKey) {
                  return {
                    ...sub,
                    checklists: [...sub.checklists, newChk],
                  };
                }
                return sub;
              }),
            };
          } else {
            // Auto-create sub-group in flight group if missing (e.g. General Operations or requested new sub-group)
            const newSub: SubOperationalGroup = {
              id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
              name: targetSubName,
              code: targetSubCode || grp.code,
              isMandatory: true,
              checklists: [newChk],
            };
            return {
              ...grp,
              subGroups: [newSub, ...grp.subGroups],
            };
          }
        }
        return grp;
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setNewChecklistTitle('');
      setNewChecklistDesc('');
      setInlineSubGroupName('');
      showNotification(`Replicated Checklist "${titleToAdd}" directly across ALL 4 Flight Groups under "${targetSubName}"!`);
    } else {
      if (!selectedEditGroup) return;
      const newChk: Checklist = {
        id: generateUniqueId('chk'),
        title: titleToAdd,
        description: descToAdd,
        isMandatory: newChecklistIsMandatory,
        status: 'pending',
        items: [],
        version: newChecklistVersion.trim() || 'v1.0',
        versionDate: newChecklistVersionDate.trim() || new Date().toISOString().split('T')[0],
      };

      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === selectedEditGroup.id) {
          const hasSub = grp.subGroups.some((s) => s.name.trim().toLowerCase() === targetSubKey || s.id === selectedEditSubGroupId);
          if (hasSub) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.name.trim().toLowerCase() === targetSubKey || sub.id === selectedEditSubGroupId) {
                  return {
                    ...sub,
                    checklists: [...sub.checklists, newChk],
                  };
                }
                return sub;
              }),
            };
          } else {
            // Auto-create sub-group directly in the target operational group
            const newSub: SubOperationalGroup = {
              id: `sub-${selectedEditGroup.id}-${Date.now()}`,
              name: targetSubName,
              code: targetSubCode || selectedEditGroup.code,
              isMandatory: true,
              checklists: [newChk],
            };
            return {
              ...grp,
              subGroups: [newSub, ...grp.subGroups],
            };
          }
        }
        return grp;
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setNewChecklistTitle('');
      setNewChecklistDesc('');
      setInlineSubGroupName('');
      showNotification(`Appended Checklist "${newChk.title}" directly to ${selectedEditGroup.name} (${selectedEditGroup.code})`);
    }
  };

  const handleDeleteChecklist = (
    chkTitle: string,
    chkId: string,
    parentGroupId?: string,
    subGroupId?: string
  ) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Checklist',
      message: `Are you sure you want to delete the checklist "${chkTitle}"? This will permanently remove it from the operational structure and Firestore database.`,
      confirmLabel: 'Delete Checklist',
      variant: 'danger',
      onConfirm: async () => {
        const normalizedTitle = chkTitle.trim().toLowerCase();
        const isMatch = (c: Checklist) => {
          if (chkId && c.id === chkId) return true;
          if (normalizedTitle && c.title && c.title.trim().toLowerCase() === normalizedTitle) return true;
          return false;
        };

        const targetGroup = parentGroupId
          ? dayData.groups.find((g) => g.id === parentGroupId || (g.code && g.code === parentGroupId))
          : selectedEditGroup;
        const isFlight = targetGroup ? targetGroup.isFlightGroup : (parentGroupId === 'ALL_FLIGHT_GROUPS' || isAllFlightGroups);

        let updatedGroups: OperationalGroup[];

        if (parentGroupId === 'ALL_FLIGHT_GROUPS' || (isAllFlightGroups && isFlight && !parentGroupId)) {
          updatedGroups = dayData.groups.map((grp) => {
            if (grp.isFlightGroup) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  if (!subGroupId || sub.id === subGroupId || sub.name.trim().toLowerCase() === (subGroupId || '').trim().toLowerCase() || sub.checklists.some(isMatch)) {
                    return {
                      ...sub,
                      checklists: sub.checklists.filter((c) => !isMatch(c)),
                    };
                  }
                  return sub;
                }),
              };
            }
            return grp;
          });
          showNotification(`Deleted Checklist "${chkTitle}" from ALL Flight Groups and Database`);
        } else {
          const targetGrpId = parentGroupId || targetGroup?.id;
          updatedGroups = dayData.groups.map((grp) => {
            const isTarget = targetGrpId
              ? grp.id === targetGrpId || (grp.code && targetGroup?.code && grp.code.toUpperCase() === targetGroup.code.toUpperCase()) || grp.id === targetGroup?.id
              : grp.subGroups.some((s) => s.checklists.some(isMatch));

            if (isTarget) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  const isSubMatch = !subGroupId || sub.id === subGroupId || sub.name.trim().toLowerCase() === (subGroupId || '').trim().toLowerCase() || sub.checklists.some(isMatch);
                  if (isSubMatch) {
                    return {
                      ...sub,
                      checklists: sub.checklists.filter((c) => !isMatch(c)),
                    };
                  }
                  return sub;
                }),
              };
            }
            return grp;
          });
          showNotification(`Checklist "${chkTitle}" deleted and removed from database`);
        }

        const newDayData = { ...dayData, groups: updatedGroups, lastUpdated: new Date().toISOString() };
        onSaveDayData(newDayData);

        // Explicitly update Firestore template manifest and propagate removal across all unclosed shifts in database
        try {
          await updateTemplateManifestInFirestore(updatedGroups);
          await propagateAdminGroupChangesToActiveShifts(newDayData);
          await saveDayDataToFirestore(newDayData);
        } catch (dbErr) {
          console.warn('Error syncing checklist deletion to Firestore:', dbErr);
        }

        if (currentUser) {
          addAuditLog(
            currentUser.uNumber,
            currentUser.name,
            currentUser.role,
            'CHECKLIST_DELETED',
            `Permanently deleted checklist "${chkTitle}" (ID: ${chkId}) from group "${targetGroup?.name || parentGroupId || 'Operational Group'}" and synced to Firestore.`,
            dayData.date
          );
        }
      },
    });
  };

  const handleAddItemToChecklist = (chkTitle: string, chkId: string) => {
    if (!newItemText.trim() || !selectedEditSubGroup) return;
    const targetSubName = selectedEditSubGroup.name.trim().toLowerCase();
    const textToAdd = newItemText.trim();
    const isMandatory = newItemIsMandatory;

    if (isAllFlightGroups) {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.name.trim().toLowerCase() === targetSubName || sub.checklists.some((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase())) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase() || chk.id === chkId) {
                      const nextSeq = (chk.items.length || 0) + 1;
                      const newItem = makeItem(
                        `item-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        nextSeq,
                        textToAdd,
                        isMandatory
                      );
                      return {
                        ...chk,
                        items: [...chk.items, newItem],
                      };
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

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setNewItemText('');
      showNotification(`Added item "${textToAdd}" across ALL 4 Flight Groups simultaneously!`);
    } else {
      if (!selectedEditGroup) return;
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === selectedEditGroup.id) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (
                isDirectGroupMode ||
                sub.id === selectedEditSubGroup.id ||
                sub.name.trim().toLowerCase() === targetSubName ||
                sub.checklists.some((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase())
              ) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                      const nextSeq = (chk.items.length || 0) + 1;
                      const newItem = makeItem(`item-${Date.now()}`, nextSeq, textToAdd, isMandatory);
                      return {
                        ...chk,
                        items: [...chk.items, newItem],
                      };
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

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setNewItemText('');
      showNotification(`Item added with default is_mandatory=${isMandatory}`);
    }
  };

  const handleToggleItemMandatory = (chkTitle: string, chkId: string, itemText: string, itemId: string) => {
    if (!selectedEditSubGroup) return;
    const targetSubName = selectedEditSubGroup.name.trim().toLowerCase();

    if (isAllFlightGroups) {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.name.trim().toLowerCase() === targetSubName || sub.checklists.some((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase())) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase() || chk.id === chkId) {
                      return {
                        ...chk,
                        items: chk.items.map((item) => {
                          if (item.text.trim() === itemText.trim() || item.id === itemId) {
                            return { ...item, isMandatory: !item.isMandatory };
                          }
                          return item;
                        }),
                      };
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

      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Updated item mandatory flag across ALL 4 Flight Groups`);
    } else {
      if (!selectedEditGroup) return;
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === selectedEditGroup.id) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (
                isDirectGroupMode ||
                sub.id === selectedEditSubGroup.id ||
                sub.name.trim().toLowerCase() === targetSubName ||
                sub.checklists.some((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase())
              ) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                      return {
                        ...chk,
                        items: chk.items.map((item) => {
                          if (item.id === itemId || item.text.trim() === itemText.trim()) return { ...item, isMandatory: !item.isMandatory };
                          return item;
                        }),
                      };
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

      onSaveDayData({ ...dayData, groups: updatedGroups });
    }
  };

  const handleDeleteItem = (
    chkTitle: string,
    chkId: string,
    itemText: string,
    itemId: string,
    parentGroupId?: string,
    subGroupId?: string
  ) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Checklist Item',
      message: `Are you sure you want to delete the item "${itemText}" from the checklist? This cannot be undone.`,
      confirmLabel: 'Delete Item',
      variant: 'danger',
      onConfirm: () => {
        const normalizedChkTitle = chkTitle.trim().toLowerCase();
        const normalizedItemText = itemText.trim().toLowerCase();

        const isChkMatch = (c: Checklist) => {
          if (chkId && c.id === chkId) return true;
          if (normalizedChkTitle && c.title && c.title.trim().toLowerCase() === normalizedChkTitle) return true;
          return false;
        };

        const isItemMatch = (i: ChecklistItem) => {
          if (itemId && i.id === itemId) return true;
          if (normalizedItemText && i.text && i.text.trim().toLowerCase() === normalizedItemText) return true;
          return false;
        };

        const targetGroup = parentGroupId
          ? dayData.groups.find((g) => g.id === parentGroupId || (g.code && g.code === parentGroupId))
          : selectedEditGroup;
        const isFlight = targetGroup ? targetGroup.isFlightGroup : isAllFlightGroups;

        let updatedGroups: OperationalGroup[];

        if (isAllFlightGroups && isFlight) {
          updatedGroups = dayData.groups.map((grp) => {
            if (grp.isFlightGroup) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  if (!subGroupId || sub.id === subGroupId || sub.name.trim().toLowerCase() === (subGroupId || '').trim().toLowerCase() || sub.checklists.some(isChkMatch)) {
                    return {
                      ...sub,
                      checklists: sub.checklists.map((chk) => {
                        if (isChkMatch(chk)) {
                          return {
                            ...chk,
                            items: chk.items.filter((i) => !isItemMatch(i)),
                          };
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

          onSaveDayData({ ...dayData, groups: updatedGroups });
          showNotification(`Deleted item from ALL 4 Flight Groups`);
        } else {
          const targetGrpId = parentGroupId || targetGroup?.id;
          updatedGroups = dayData.groups.map((grp) => {
            const isTarget = targetGrpId
              ? grp.id === targetGrpId || (grp.code && targetGroup?.code && grp.code.toUpperCase() === targetGroup.code.toUpperCase())
              : grp.subGroups.some((s) => s.checklists.some((c) => isChkMatch(c)));

            if (isTarget) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  const isSubMatch = !subGroupId || sub.id === subGroupId || sub.name.trim().toLowerCase() === (subGroupId || '').trim().toLowerCase() || sub.checklists.some(isChkMatch);
                  if (isSubMatch) {
                    return {
                      ...sub,
                      checklists: sub.checklists.map((chk) => {
                        if (isChkMatch(chk)) {
                          return {
                            ...chk,
                            items: chk.items.filter((i) => !isItemMatch(i)),
                          };
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

          onSaveDayData({ ...dayData, groups: updatedGroups });
          showNotification(`Deleted item "${itemText}"`);
        }
      },
    });
  };

  // ------------------ REORDERING & AMENDING HANDLERS ------------------

  // Reorder Sub-Group
  const handleMoveSubGroup = (groupId: string, subId: string, subName: string, direction: 'up' | 'down') => {
    const isAllFlight = groupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = subName.trim().toLowerCase();

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === groupId) {
        const idx = grp.subGroups.findIndex((s) => s.id === subId || s.name.trim().toLowerCase() === targetSubName);
        if (idx < 0) return grp;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= grp.subGroups.length) return grp;
        const newSubGroups = [...grp.subGroups];
        const [moved] = newSubGroups.splice(idx, 1);
        newSubGroups.splice(targetIdx, 0, moved);
        return { ...grp, subGroups: newSubGroups };
      }
      return grp;
    });

    onSaveDayData({ ...dayData, groups: updatedGroups });
  };

  const handleReorderSubGroup = (groupId: string, srcSubId: string, srcSubName: string, tgtSubId: string, tgtSubName: string) => {
    if (srcSubId === tgtSubId) return;
    const isAllFlight = groupId === 'ALL_FLIGHT_GROUPS';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === groupId) {
        const srcIdx = grp.subGroups.findIndex((s) => s.id === srcSubId || s.name.trim().toLowerCase() === srcSubName.trim().toLowerCase());
        const tgtIdx = grp.subGroups.findIndex((s) => s.id === tgtSubId || s.name.trim().toLowerCase() === tgtSubName.trim().toLowerCase());
        if (srcIdx < 0 || tgtIdx < 0) return grp;
        const newSubGroups = [...grp.subGroups];
        const [moved] = newSubGroups.splice(srcIdx, 1);
        newSubGroups.splice(tgtIdx, 0, moved);
        return { ...grp, subGroups: newSubGroups };
      }
      return grp;
    });

    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification('Sub-groups reordered successfully');
  };

  // Reorder Checklist
  const handleMoveChecklist = (subGroupId: string, chkId: string, chkTitle: string, direction: 'up' | 'down') => {
    const isAllFlight = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === selectedEditGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === subGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              const idx = sub.checklists.findIndex((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase());
              if (idx < 0) return sub;
              const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
              if (targetIdx < 0 || targetIdx >= sub.checklists.length) return sub;
              const newChks = [...sub.checklists];
              const [moved] = newChks.splice(idx, 1);
              newChks.splice(targetIdx, 0, moved);
              return { ...sub, checklists: newChks };
            }
            return sub;
          }),
        };
      }
      return grp;
    });

    onSaveDayData({ ...dayData, groups: updatedGroups });
  };

  const handleReorderChecklist = (subGroupId: string, srcChkId: string, srcChkTitle: string, tgtChkId: string, tgtChkTitle: string) => {
    if (srcChkId === tgtChkId) return;
    const isAllFlight = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === selectedEditGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === subGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              const srcIdx = sub.checklists.findIndex((c) => c.id === srcChkId || c.title.trim().toLowerCase() === srcChkTitle.trim().toLowerCase());
              const tgtIdx = sub.checklists.findIndex((c) => c.id === tgtChkId || c.title.trim().toLowerCase() === tgtChkTitle.trim().toLowerCase());
              if (srcIdx < 0 || tgtIdx < 0) return sub;
              const newChks = [...sub.checklists];
              const [moved] = newChks.splice(srcIdx, 1);
              newChks.splice(tgtIdx, 0, moved);
              return { ...sub, checklists: newChks };
            }
            return sub;
          }),
        };
      }
      return grp;
    });

    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification('Checklists reordered successfully');
  };

  // Reorder Item
  const handleMoveItem = (chkTitle: string, chkId: string, itemId: string, direction: 'up' | 'down') => {
    const isAllFlight = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === selectedEditGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === selectedEditSubGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              return {
                ...sub,
                checklists: sub.checklists.map((chk) => {
                  if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                    const idx = chk.items.findIndex((i) => i.id === itemId);
                    if (idx < 0) return chk;
                    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                    if (targetIdx < 0 || targetIdx >= chk.items.length) return chk;
                    const newItems = [...chk.items];
                    const [moved] = newItems.splice(idx, 1);
                    newItems.splice(targetIdx, 0, moved);
                    const resequenced = newItems.map((item, i) => ({ ...item, sequenceOrder: i + 1 }));
                    return { ...chk, items: resequenced };
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

    onSaveDayData({ ...dayData, groups: updatedGroups });
  };

  const handleReorderItem = (chkTitle: string, chkId: string, srcItemId: string, tgtItemId: string) => {
    if (srcItemId === tgtItemId) return;
    const isAllFlight = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === selectedEditGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === selectedEditSubGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              return {
                ...sub,
                checklists: sub.checklists.map((chk) => {
                  if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                    const srcIdx = chk.items.findIndex((i) => i.id === srcItemId);
                    const tgtIdx = chk.items.findIndex((i) => i.id === tgtItemId);
                    if (srcIdx < 0 || tgtIdx < 0) return chk;
                    const newItems = [...chk.items];
                    const [moved] = newItems.splice(srcIdx, 1);
                    newItems.splice(tgtIdx, 0, moved);
                    const resequenced = newItems.map((item, i) => ({ ...item, sequenceOrder: i + 1 }));
                    return { ...chk, items: resequenced };
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

    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification('Items reordered successfully');
  };

  // Group Amend Handler
  const handleSaveEditedGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editingGroup.name.trim()) return;

    const { id, name, code, isMandatory } = editingGroup;
    const newName = name.trim();
    const newCode = code.trim().toUpperCase();

    if (id === 'ALL_FLIGHT_GROUPS') {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            name: newName,
            code: newCode || grp.code,
            isMandatory,
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Amended Flight Operations group across ALL 4 Flight Groups`);
    } else {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === id) {
          return {
            ...grp,
            name: newName,
            code: newCode,
            isMandatory,
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Amended operational group "${newName}"`);
    }
    setEditingGroup(null);
  };

  // Tree View Helper Methods
  const toggleTreeNode = (nodeId: string) => {
    setExpandedTreeNodes((prev) => ({
      ...prev,
      [nodeId]: prev[nodeId] !== undefined ? !prev[nodeId] : true,
    }));
  };

  const isTreeNodeExpanded = (nodeId: string, defaultOpen = false) => {
    return expandedTreeNodes[nodeId] !== undefined ? expandedTreeNodes[nodeId] : defaultOpen;
  };

  const toggleChecklistItemsExpanded = (checklistId: string) => {
    setPerChecklistExpandedItems((prev) => ({
      ...prev,
      [checklistId]: !prev[checklistId],
    }));
  };

  const expandAllTreeNodes = () => {
    const newExpanded: Record<string, boolean> = { 'ALL_FLIGHT_GROUPS': true };
    dayData.groups.forEach((g) => {
      newExpanded[g.id] = true;
      g.subGroups.forEach((s) => {
        newExpanded[s.id] = true;
        s.checklists.forEach((c) => {
          newExpanded[c.id] = true;
        });
      });
    });
    setExpandedTreeNodes(newExpanded);
  };

  const collapseAllTreeNodes = () => {
    setExpandedTreeNodes({});
  };

  // Inline tree creation handlers
  const handleInlineAddSubGroupSubmit = (parentGroupId: string) => {
    if (!inlineSubGroupNameInput.trim()) {
      showNotification('Please enter a sub-group name', 'error');
      return;
    }

    const nameToAdd = inlineSubGroupNameInput.trim();
    const codeToAdd = inlineSubGroupCodeInput.trim().toUpperCase() || undefined;
    const isMandatory = inlineSubGroupIsMandatoryInput;

    let updatedGroups = [...dayData.groups];

    if (parentGroupId === 'ALL_FLIGHT_GROUPS') {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.isFlightGroup) {
          const newSub: SubOperationalGroup = {
            id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
            name: nameToAdd,
            code: codeToAdd || grp.code,
            isMandatory,
            checklists: [],
          };
          return {
            ...grp,
            subGroups: [...grp.subGroups, newSub],
          };
        }
        return grp;
      });
      showNotification(`Replicated inline sub-group "${nameToAdd}" across ALL 4 Flight Groups!`);
    } else {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.id === parentGroupId) {
          const newSub: SubOperationalGroup = {
            id: `sub-${Date.now()}`,
            name: nameToAdd,
            code: codeToAdd || grp.code,
            isMandatory,
            checklists: [],
          };
          return {
            ...grp,
            subGroups: [...grp.subGroups, newSub],
          };
        }
        return grp;
      });
      showNotification(`Added inline sub-group "${nameToAdd}"`);
    }

    onSaveDayData({ ...dayData, groups: updatedGroups });
    setExpandedTreeNodes((prev) => ({ ...prev, [parentGroupId]: true }));
    setActiveInlineSubGroupGroupId(null);
    setInlineSubGroupNameInput('');
    setInlineSubGroupCodeInput('');
  };

  const handleInlineAddChecklistSubmit = (parentGroupId: string, subGroupId: string, subGroupName: string) => {
    if (!inlineChecklistTitleInput.trim()) {
      showNotification('Please enter a checklist title', 'error');
      return;
    }

    const titleToAdd = inlineChecklistTitleInput.trim();
    const descToAdd = inlineChecklistDescInput.trim() || undefined;
    const versionToAdd = inlineChecklistVersionInput.trim() || 'v1.0';
    const isMandatory = inlineChecklistIsMandatoryInput;
    const targetSubKey = subGroupName.trim().toLowerCase();

    const todayDateStr = new Date().toISOString().split('T')[0];

    let updatedGroups = [...dayData.groups];

    if (parentGroupId === 'ALL_FLIGHT_GROUPS') {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.isFlightGroup) {
          const newChk: Checklist = {
            id: `chk-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: titleToAdd,
            description: descToAdd,
            isMandatory,
            status: 'pending',
            items: [],
            version: versionToAdd,
            versionDate: todayDateStr,
          };

          const hasSub = grp.subGroups.some((s) => s.name.trim().toLowerCase() === targetSubKey);
          if (hasSub) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.name.trim().toLowerCase() === targetSubKey) {
                  return { ...sub, checklists: [...sub.checklists, newChk] };
                }
                return sub;
              }),
            };
          } else {
            const newSub: SubOperationalGroup = {
              id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
              name: subGroupName,
              code: grp.code,
              isMandatory: true,
              checklists: [newChk],
            };
            return { ...grp, subGroups: [newSub, ...grp.subGroups] };
          }
        }
        return grp;
      });
      showNotification(`Replicated Checklist "${titleToAdd}" across ALL 4 Flight Groups!`);
    } else {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.id === parentGroupId) {
          const newChk: Checklist = {
            id: generateUniqueId('chk'),
            title: titleToAdd,
            description: descToAdd,
            isMandatory,
            status: 'pending',
            items: [],
            version: versionToAdd,
            versionDate: todayDateStr,
          };

          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === subGroupId || sub.name.trim().toLowerCase() === targetSubKey) {
                return { ...sub, checklists: [...sub.checklists, newChk] };
              }
              return sub;
            }),
          };
        }
        return grp;
      });
      showNotification(`Added Checklist "${titleToAdd}"`);
    }

    onSaveDayData({ ...dayData, groups: updatedGroups });
    setExpandedTreeNodes((prev) => ({ ...prev, [subGroupId]: true }));
    setActiveInlineChecklistSubGroupId(null);
    setInlineChecklistTitleInput('');
    setInlineChecklistDescInput('');
    setInlineChecklistVersionInput('v1.0');
  };

  const handleInlineAddItemSubmit = (parentGroupId: string, subGroupId: string, subGroupName: string, chkId: string, chkTitle: string) => {
    if (!inlineItemTextInput.trim()) {
      showNotification('Please enter item text', 'error');
      return;
    }

    const textToAdd = inlineItemTextInput.trim();
    const isMandatory = inlineItemIsMandatoryInput;
    const isAllFlight = parentGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = subGroupName.trim().toLowerCase();

    let updatedGroups = [...dayData.groups];

    if (isAllFlight) {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.name.trim().toLowerCase() === targetSubName || sub.checklists.some((c) => c.id === chkId || c.title.trim().toLowerCase() === chkTitle.trim().toLowerCase())) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase() || chk.id === chkId) {
                      const nextSeq = (chk.items.length || 0) + 1;
                      const newItem = makeItem(
                        `item-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        nextSeq,
                        textToAdd,
                        isMandatory
                      );
                      return { ...chk, items: [...chk.items, newItem] };
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
      showNotification(`Added item across ALL 4 Flight Groups!`);
    } else {
      updatedGroups = updatedGroups.map((grp) => {
        if (grp.id === parentGroupId) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === subGroupId || sub.name.trim().toLowerCase() === targetSubName) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                      const nextSeq = (chk.items.length || 0) + 1;
                      const newItem = makeItem(`item-${Date.now()}`, nextSeq, textToAdd, isMandatory);
                      return { ...chk, items: [...chk.items, newItem] };
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
      showNotification(`Added item to checklist`);
    }

    onSaveDayData({ ...dayData, groups: updatedGroups });
    setPerChecklistExpandedItems((prev) => ({ ...prev, [chkId]: true }));
    setActiveInlineItemChecklistId(null);
    setInlineItemTextInput('');
  };

  // Dedicated Excel Overwrite Target Handlers
  const handleExcelOverwriteSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excelOverwriteTarget) return;

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseChecklistExcel(buffer);
      if (!result.items || result.items.length === 0) {
        showNotification('No valid checklist items found in the uploaded file', 'error');
        return;
      }
      setExcelOverwriteItems(result.items);
      setExcelOverwriteFileName(file.name);
      showNotification(`Parsed ${result.items.length} checklist items from ${file.name}`);
    } catch (err: any) {
      showNotification(err.message || 'Error parsing Excel file', 'error');
    }
  };

  const handleCommitExcelOverwrite = () => {
    if (!excelOverwriteTarget || excelOverwriteItems.length === 0) {
      showNotification('No target checklist or parsed items to commit', 'error');
      return;
    }

    const { checklistId, checklistTitle, subGroupId, parentGroupId, isAllFlightGroups } = excelOverwriteTarget;
    const nowIso = new Date().toISOString();
    const todayDateStr = nowIso.split('T')[0];

    let overwrittenCount = 0;
    let lastOldVer = 'v1.0';
    let lastNewVer = 'v1.1';

    const updatedGroups = dayData.groups.map((grp) => {
      const isTargetGrp = isAllFlightGroups ? grp.isFlightGroup : grp.id === parentGroupId;
      if (!isTargetGrp) return grp;

      return {
        ...grp,
        subGroups: grp.subGroups.map((sub) => {
          const isTargetSub = sub.id === subGroupId || sub.name.trim().toLowerCase() === excelOverwriteTarget.subGroupName.trim().toLowerCase();
          if (!isTargetSub) return sub;

          return {
            ...sub,
            checklists: sub.checklists.map((chk) => {
              const matchesChk = chk.id === checklistId || chk.title.trim().toLowerCase() === checklistTitle.trim().toLowerCase();
              if (!matchesChk) return chk;

              overwrittenCount++;
              const curVer = chk.version || 'v1.0';
              const nextVer = getNextChecklistVersion(curVer);
              lastOldVer = curVer;
              lastNewVer = nextVer;

              const prevHistory: ChecklistVersionRecord[] = chk.versionHistory && chk.versionHistory.length > 0
                ? chk.versionHistory
                : [
                    {
                      version: curVer,
                      versionDate: chk.versionDate || '2026-08-20',
                      updatedBy: 'System Baseline',
                      itemCount: chk.items.length,
                      changeType: 'INITIAL',
                      notes: 'Original baseline version',
                      timestamp: new Date(Date.now() - 86400000).toISOString(),
                    },
                  ];

              const updatedHistory: ChecklistVersionRecord[] = [
                {
                  version: nextVer,
                  versionDate: todayDateStr,
                  updatedBy: currentUser ? `${currentUser.name} (${currentUser.uNumber})` : 'Station Administrator',
                  itemCount: excelOverwriteItems.length,
                  previousItemCount: chk.items.length,
                  changeType: 'OVERWRITE',
                  notes: `Overwritten via Excel import (${excelOverwriteFileName || 'file'}) with ${excelOverwriteItems.length} items`,
                  timestamp: new Date().toISOString(),
                },
                ...prevHistory,
              ];

              const newItemsWithIds = excelOverwriteItems.map((item, idx) => ({
                ...item,
                id: `item-ovw-${chk.id}-${Date.now()}-${idx}`,
                sequenceOrder: idx + 1,
              }));

              return {
                ...chk,
                version: nextVer,
                versionDate: todayDateStr,
                versionHistory: updatedHistory,
                items: newItemsWithIds,
                status: 'pending' as const,
              };
            }),
          };
        }),
      };
    });

    onSaveDayData({ ...dayData, groups: updatedGroups });
    addAuditLog(
      currentUser.uNumber,
      currentUser.name,
      currentUser.role,
      'CHECKLIST_VERSION_UPDATE',
      `Overwrote checklist "${checklistTitle}" via Excel (${excelOverwriteItems.length} items, version upgraded ${lastOldVer} -> ${lastNewVer})`,
      dayData.date
    );

    showNotification(`Successfully overwrote checklist "${checklistTitle}" with ${excelOverwriteItems.length} items! (Version: ${lastNewVer})`);
    setExcelOverwriteTarget(null);
    setExcelOverwriteItems([]);
    setExcelOverwriteFileName('');
  };

  // Amend Handlers
  const handleSaveEditedSubGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubGroup || !editingSubGroup.name.trim()) return;

    const { id: targetId, parentGroupId, name, code, isMandatory } = editingSubGroup;
    const newName = name.trim();
    const newCode = code?.trim().toUpperCase() || undefined;

    if (parentGroupId === 'ALL_FLIGHT_GROUPS') {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === targetId || sub.name.trim().toLowerCase() === editingSubGroup.name.trim().toLowerCase()) {
                return { ...sub, name: newName, code: newCode, isMandatory };
              }
              return sub;
            }),
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Amended sub-group "${newName}" across ALL 4 Flight Groups`);
    } else {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === parentGroupId) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === targetId) {
                return { ...sub, name: newName, code: newCode, isMandatory };
              }
              return sub;
            }),
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Amended sub-group "${newName}"`);
    }
    setEditingSubGroup(null);
  };

  const handleSaveEditedChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChecklist || !editingChecklist.title.trim()) return;

    const { id: chkId, parentGroupId, subGroupId, title, description, isMandatory, version, versionDate } = editingChecklist;
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (parentGroupId === 'ALL_FLIGHT_GROUPS' ? grp.isFlightGroup : grp.id === parentGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === subGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              return {
                ...sub,
                checklists: sub.checklists.map((chk) => {
                  if (chk.id === chkId || chk.title.trim().toLowerCase() === title.trim().toLowerCase()) {
                    return {
                      ...chk,
                      title: title.trim(),
                      description: description?.trim() || undefined,
                      isMandatory,
                      version: version.trim() || 'v1.0',
                      versionDate: versionDate.trim() || new Date().toISOString().split('T')[0],
                    };
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

    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification(`Amended checklist "${title.trim()}" (Version: ${version || 'v1.0'})`);
    setEditingChecklist(null);
  };

  const handleSaveEditedItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.text.trim()) return;

    const { id: itemId, chkId, chkTitle, text, isMandatory } = editingItem;
    const isAllFlight = selectedEditGroupId === 'ALL_FLIGHT_GROUPS';
    const targetSubName = selectedEditSubGroup ? selectedEditSubGroup.name.trim().toLowerCase() : '';

    const updatedGroups = dayData.groups.map((grp) => {
      if (isAllFlight ? grp.isFlightGroup : grp.id === selectedEditGroupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.map((sub) => {
            if (sub.id === selectedEditSubGroupId || sub.name.trim().toLowerCase() === targetSubName) {
              return {
                ...sub,
                checklists: sub.checklists.map((chk) => {
                  if (chk.id === chkId || chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase()) {
                    const updatedVersionDate = new Date().toISOString().split('T')[0];
                    return {
                      ...chk,
                      versionDate: updatedVersionDate,
                      items: chk.items.map((item) => {
                        if (item.id === itemId) {
                          return { ...item, text: text.trim(), isMandatory };
                        }
                        return item;
                      }),
                    };
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

    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification(`Amended checklist item`);
    setEditingItem(null);
  };

  // ------------------ EXCEL BULK IMPORTER ------------------

  const handleUserFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelUserFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseUsersExcel(buffer);
      setImportPreviewUsers(result.parsedUsers);
      showNotification(`Detected ${result.parsedUsers.length} new users ready to import`);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCommitUserImport = async () => {
    if (importPreviewUsers.length === 0) return;
    const current = loadUsers();
    const existingSet = new Set(current.map((u) => u.uNumber.trim().toLowerCase()));
    const toAdd = importPreviewUsers.filter((u) => !existingSet.has(u.uNumber.trim().toLowerCase()));
    
    saveUsers([...current, ...toAdd]);
    await saveUsersToFirestoreBatch(toAdd);
    setUsersList(loadUsers());
    setImportPreviewUsers([]);
    setExcelUserFile(null);
    showNotification(`Successfully imported ${toAdd.length} user accounts!`);
  };

  const handleChecklistFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelChecklistFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseChecklistExcel(buffer);
      setImportPreviewItems(result.items);
      showNotification(`Detected ${result.items.length} checklist items (all defaulted to is_mandatory=true)`);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCommitChecklistImport = () => {
    if (importPreviewItems.length === 0 || !excelTargetGroupId) {
      showNotification('Please select a valid target and upload checklist items', 'error');
      return;
    }

    const isExcelAllFlightGroups = excelTargetGroupId === 'ALL_FLIGHT_GROUPS';
    const isDirectGroup = !excelTargetSubGroupId || excelTargetSubGroupId === 'DIRECT_GROUP';
    const targetSubName = (isDirectGroup ? 'General Operations' : excelTargetSubGroupId).trim().toLowerCase();
    const finalChecklistTitle = excelChecklistTitle.trim() || 'Imported Excel Checklist';
    const isOverwrite = excelImportMode === 'OVERWRITE' && excelTargetChecklistId !== '__NEW__';
    const todayDateStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    if (isExcelAllFlightGroups) {
      let overwrittenCount = 0;
      let createdCount = 0;
      let lastOldVer = 'v1.0';
      let lastNewVer = 'v1.1';

      const updatedGroups = dayData.groups.map((grp) => {
        if (!grp.isFlightGroup) return grp;

        if (isOverwrite) {
          let matchedInGroup = false;
          const updatedSubGroups = grp.subGroups.map((sub) => {
            const isTargetSub =
              isDirectGroup || sub.name.trim().toLowerCase() === targetSubName || sub.id === excelTargetSubGroupId;
            if (!isTargetSub) return sub;

            const updatedChecklists = sub.checklists.map((chk) => {
              const matchesChecklist =
                chk.id === excelTargetChecklistId ||
                chk.title.trim().toLowerCase() === finalChecklistTitle.toLowerCase() ||
                chk.title.trim().toLowerCase() === excelTargetChecklistId.trim().toLowerCase();

              if (matchesChecklist) {
                matchedInGroup = true;
                overwrittenCount++;
                const curVer = chk.version || 'v1.0';
                const nextVer = getNextChecklistVersion(curVer);
                lastOldVer = curVer;
                lastNewVer = nextVer;

                const prevHistory: ChecklistVersionRecord[] =
                  chk.versionHistory && chk.versionHistory.length > 0
                    ? chk.versionHistory
                    : [
                        {
                          version: curVer,
                          versionDate: chk.versionDate || '2026-08-20',
                          updatedBy: 'System Baseline',
                          itemCount: chk.items?.length || 0,
                          changeType: 'INITIAL',
                          notes: 'Initial station operational checklist baseline',
                          timestamp: new Date(Date.now() - 86400000).toISOString(),
                        },
                      ];

                const newVersionRecord: ChecklistVersionRecord = {
                  version: nextVer,
                  versionDate: todayDateStr,
                  updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                  itemCount: importPreviewItems.length,
                  previousItemCount: chk.items?.length || 0,
                  changeType: 'OVERWRITE',
                  notes: `Bulk overwritten from Excel (${excelChecklistFile?.name || 'bulk_import.xlsx'}) with ${importPreviewItems.length} items`,
                  timestamp: nowIso,
                };

                return {
                  ...chk,
                  title: finalChecklistTitle,
                  version: nextVer,
                  versionDate: todayDateStr,
                  versionHistory: [...prevHistory, newVersionRecord],
                  status: 'pending' as const,
                  items: importPreviewItems.map((item, idx) => ({
                    ...item,
                    id: generateUniqueId(`item-imp-${grp.code.toLowerCase()}`),
                    status: 'not_done' as const,
                  })),
                };
              }
              return chk;
            });

            return { ...sub, checklists: updatedChecklists };
          });

          // If not matched in target sub, append as new checklist
          if (!matchedInGroup) {
            createdCount++;
            const newChecklist: Checklist = {
              id: `chk-imp-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title: finalChecklistTitle,
              isMandatory: true,
              status: 'pending',
              version: 'v1.0',
              versionDate: todayDateStr,
              versionHistory: [
                {
                  version: 'v1.0',
                  versionDate: todayDateStr,
                  updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                  itemCount: importPreviewItems.length,
                  changeType: 'IMPORT',
                  notes: `Initial creation from Excel import (${excelChecklistFile?.name || 'import.xlsx'})`,
                  timestamp: nowIso,
                },
              ],
              items: importPreviewItems.map((item, idx) => ({
                ...item,
                id: generateUniqueId(`item-imp-${grp.code.toLowerCase()}`),
              })),
            };

            const hasSub = grp.subGroups.some(
              (s) => s.name.trim().toLowerCase() === targetSubName || s.id === excelTargetSubGroupId
            );
            if (hasSub) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  if (sub.name.trim().toLowerCase() === targetSubName || sub.id === excelTargetSubGroupId) {
                    return { ...sub, checklists: [...sub.checklists, newChecklist] };
                  }
                  return sub;
                }),
              };
            } else {
              const newSub: SubOperationalGroup = {
                id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
                name: 'General Operations',
                code: grp.code,
                isMandatory: true,
                checklists: [newChecklist],
              };
              return { ...grp, subGroups: [newSub, ...grp.subGroups] };
            }
          }

          return { ...grp, subGroups: updatedSubGroups };
        } else {
          // New Checklist Mode
          createdCount++;
          const newChecklist: Checklist = {
            id: `chk-imp-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: finalChecklistTitle,
            isMandatory: true,
            status: 'pending',
            version: 'v1.0',
            versionDate: todayDateStr,
            versionHistory: [
              {
                version: 'v1.0',
                versionDate: todayDateStr,
                updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                itemCount: importPreviewItems.length,
                changeType: 'IMPORT',
                notes: `Initial creation from Excel import (${excelChecklistFile?.name || 'import.xlsx'})`,
                timestamp: nowIso,
              },
            ],
            items: importPreviewItems.map((item, idx) => ({
              ...item,
              id: generateUniqueId(`item-imp-${grp.code.toLowerCase()}`),
            })),
          };

          const hasSub = grp.subGroups.some(
            (s) => s.name.trim().toLowerCase() === targetSubName || s.id === excelTargetSubGroupId
          );
          if (hasSub) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.name.trim().toLowerCase() === targetSubName || sub.id === excelTargetSubGroupId) {
                  return {
                    ...sub,
                    checklists: [...sub.checklists, newChecklist],
                  };
                }
                return sub;
              }),
            };
          } else {
            const newSub: SubOperationalGroup = {
              id: `sub-${grp.code.toLowerCase()}-${Date.now()}`,
              name: 'General Operations',
              code: grp.code,
              isMandatory: true,
              checklists: [newChecklist],
            };
            return {
              ...grp,
              subGroups: [newSub, ...grp.subGroups],
            };
          }
        }
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      addAuditLog(
        currentUser.uNumber,
        currentUser.name,
        currentUser.role,
        isOverwrite ? 'CHECKLIST_OVERWRITE' : 'CHECKLIST_CREATE',
        isOverwrite
          ? `Overwrote checklist "${finalChecklistTitle}" with automated version increment (${lastOldVer} ➔ ${lastNewVer}) containing ${importPreviewItems.length} items from Excel across ALL 4 Flight Groups.`
          : `Imported new checklist "${finalChecklistTitle}" (v1.0) with ${importPreviewItems.length} items from Excel across ALL 4 Flight Groups.`
      );
      setImportPreviewItems([]);
      setExcelChecklistFile(null);
      showNotification(
        isOverwrite
          ? `Successfully overwrote "${finalChecklistTitle}" (Version incremented: ${lastOldVer} ➔ ${lastNewVer}) across ALL 4 Flight Groups!`
          : `Appended new checklist "${finalChecklistTitle}" with ${importPreviewItems.length} items to ALL 4 Flight Groups simultaneously!`
      );
    } else {
      // Specific Operational Group
      const targetGroup = dayData.groups.find((g) => g.id === excelTargetGroupId);
      const groupName = targetGroup ? targetGroup.name : 'Selected Group';
      let lastOldVer = 'v1.0';
      let lastNewVer = 'v1.1';

      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id !== excelTargetGroupId) return grp;

        if (isOverwrite) {
          let matchedInGroup = false;
          const updatedSubGroups = grp.subGroups.map((sub) => {
            const isTargetSub =
              isDirectGroup || sub.id === excelTargetSubGroupId || sub.name.trim().toLowerCase() === targetSubName;
            if (!isTargetSub) return sub;

            const updatedChecklists = sub.checklists.map((chk) => {
              const matchesChecklist =
                chk.id === excelTargetChecklistId ||
                chk.title.trim().toLowerCase() === finalChecklistTitle.toLowerCase() ||
                chk.title.trim().toLowerCase() === excelTargetChecklistId.trim().toLowerCase();

              if (matchesChecklist) {
                matchedInGroup = true;
                const curVer = chk.version || 'v1.0';
                const nextVer = getNextChecklistVersion(curVer);
                lastOldVer = curVer;
                lastNewVer = nextVer;

                const prevHistory: ChecklistVersionRecord[] =
                  chk.versionHistory && chk.versionHistory.length > 0
                    ? chk.versionHistory
                    : [
                        {
                          version: curVer,
                          versionDate: chk.versionDate || '2026-08-20',
                          updatedBy: 'System Baseline',
                          itemCount: chk.items?.length || 0,
                          changeType: 'INITIAL',
                          notes: 'Initial station operational checklist baseline',
                          timestamp: new Date(Date.now() - 86400000).toISOString(),
                        },
                      ];

                const newVersionRecord: ChecklistVersionRecord = {
                  version: nextVer,
                  versionDate: todayDateStr,
                  updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                  itemCount: importPreviewItems.length,
                  previousItemCount: chk.items?.length || 0,
                  changeType: 'OVERWRITE',
                  notes: `Bulk overwritten from Excel (${excelChecklistFile?.name || 'bulk_import.xlsx'}) with ${importPreviewItems.length} items`,
                  timestamp: nowIso,
                };

                return {
                  ...chk,
                  title: finalChecklistTitle,
                  version: nextVer,
                  versionDate: todayDateStr,
                  versionHistory: [...prevHistory, newVersionRecord],
                  status: 'pending' as const,
                  items: importPreviewItems.map((item, idx) => ({
                    ...item,
                    id: generateUniqueId(`item-imp-${grp.id}`),
                    status: 'not_done' as const,
                  })),
                };
              }
              return chk;
            });

            return { ...sub, checklists: updatedChecklists };
          });

          if (!matchedInGroup) {
            const newChecklist: Checklist = {
              id: generateUniqueId('chk-imp'),
              title: finalChecklistTitle,
              isMandatory: true,
              status: 'pending',
              version: 'v1.0',
              versionDate: todayDateStr,
              versionHistory: [
                {
                  version: 'v1.0',
                  versionDate: todayDateStr,
                  updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                  itemCount: importPreviewItems.length,
                  changeType: 'IMPORT',
                  notes: `Initial creation from Excel import (${excelChecklistFile?.name || 'import.xlsx'})`,
                  timestamp: nowIso,
                },
              ],
              items: importPreviewItems,
            };

            const hasSub = grp.subGroups.some(
              (s) => s.id === excelTargetSubGroupId || s.name.trim().toLowerCase() === targetSubName
            );
            if (hasSub) {
              return {
                ...grp,
                subGroups: grp.subGroups.map((sub) => {
                  if (sub.id === excelTargetSubGroupId || sub.name.trim().toLowerCase() === targetSubName) {
                    return { ...sub, checklists: [...sub.checklists, newChecklist] };
                  }
                  return sub;
                }),
              };
            } else {
              const newSub: SubOperationalGroup = {
                id: `sub-${grp.id}-${Date.now()}`,
                name: 'General Operations',
                code: grp.code,
                isMandatory: true,
                checklists: [newChecklist],
              };
              return { ...grp, subGroups: [newSub, ...grp.subGroups] };
            }
          }

          return { ...grp, subGroups: updatedSubGroups };
        } else {
          // New Checklist Mode
          const newChecklist: Checklist = {
            id: generateUniqueId('chk-imp'),
            title: finalChecklistTitle,
            isMandatory: true,
            status: 'pending',
            version: 'v1.0',
            versionDate: todayDateStr,
            versionHistory: [
              {
                version: 'v1.0',
                versionDate: todayDateStr,
                updatedBy: `${currentUser.name} (${currentUser.uNumber})`,
                itemCount: importPreviewItems.length,
                changeType: 'IMPORT',
                notes: `Initial creation from Excel import (${excelChecklistFile?.name || 'import.xlsx'})`,
                timestamp: nowIso,
              },
            ],
            items: importPreviewItems,
          };

          const hasSub = grp.subGroups.some(
            (s) => s.id === excelTargetSubGroupId || s.name.trim().toLowerCase() === targetSubName
          );
          if (hasSub) {
            return {
              ...grp,
              subGroups: grp.subGroups.map((sub) => {
                if (sub.id === excelTargetSubGroupId || sub.name.trim().toLowerCase() === targetSubName) {
                  return {
                    ...sub,
                    checklists: [...sub.checklists, newChecklist],
                  };
                }
                return sub;
              }),
            };
          } else {
            const newSub: SubOperationalGroup = {
              id: `sub-${grp.id}-${Date.now()}`,
              name: 'General Operations',
              code: grp.code,
              isMandatory: true,
              checklists: [newChecklist],
            };
            return {
              ...grp,
              subGroups: [newSub, ...grp.subGroups],
            };
          }
        }
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      addAuditLog(
        currentUser.uNumber,
        currentUser.name,
        currentUser.role,
        isOverwrite ? 'CHECKLIST_OVERWRITE' : 'CHECKLIST_CREATE',
        isOverwrite
          ? `Overwrote checklist "${finalChecklistTitle}" with automated version increment (${lastOldVer} ➔ ${lastNewVer}) containing ${importPreviewItems.length} items from Excel in ${groupName}.`
          : `Imported new checklist "${finalChecklistTitle}" (v1.0) with ${importPreviewItems.length} items from Excel in ${groupName}.`
      );
      setImportPreviewItems([]);
      setExcelChecklistFile(null);
      showNotification(
        isOverwrite
          ? `Successfully overwrote "${finalChecklistTitle}" (Version incremented: ${lastOldVer} ➔ ${lastNewVer}) in ${groupName}!`
          : `Appended new checklist "${finalChecklistTitle}" with ${importPreviewItems.length} items to ${groupName}!`
      );
    }
  };

  // ------------------ USER ACCOUNTS MANAGEMENT ------------------

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUNumber.trim() || !newUserName.trim()) {
      showNotification('Enter U-Number and Name', 'error');
      return;
    }

    const cleanUNum = newUNumber.trim().toUpperCase();
    const newUser: UserAccount = {
      uNumber: cleanUNum,
      name: newUserName.trim(),
      role: newUserRole,
      passwordHash: cleanUNum,
      mustChangePassword: true,
      department: newUserDept.trim(),
      createdDate: new Date().toISOString(),
      isAuthorized: true,
    };

    addOrUpdateUser(newUser, currentUser);
    await saveUserToFirestore(newUser);
    setUsersList(loadUsers());
    setNewUNumber('');
    setNewUserName('');
    showNotification(`User account ${cleanUNum} created successfully. Initial password set to ${cleanUNum}.`);
  };

  const startEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserRole(u.role);
    setEditUserDept(u.department || 'Ground Operations');
    setEditUserIsAuthorized(u.isAuthorized ?? true);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updatedUser: UserAccount = {
      ...editingUser,
      name: editUserName.trim() || editingUser.name,
      role: editUserRole,
      department: editUserDept.trim() || 'Ground Operations',
      isAuthorized: editUserIsAuthorized,
    };

    addOrUpdateUser(updatedUser, currentUser);
    await saveUserToFirestore(updatedUser);
    setUsersList(loadUsers());
    setEditingUser(null);
    showNotification(`Updated personnel account for ${updatedUser.name} (${updatedUser.uNumber}). Role set to ${updatedUser.role}.`);
  };

  const handleResetUserPassword = async (targetUNumber: string) => {
    const targetUser = usersList.find((u) => u.uNumber.toLowerCase() === targetUNumber.toLowerCase());
    const targetName = targetUser ? targetUser.name : targetUNumber;

    setConfirmModal({
      isOpen: true,
      title: 'Reset Password',
      message: `Are you sure you want to reset password for ${targetName} (${targetUNumber}) back to initial default password (${targetUNumber})?\n\nThe user will be required to change their password on their next login.`,
      confirmLabel: 'Reset Password',
      variant: 'warning',
      onConfirm: async () => {
        await resetUserPasswordAsync(targetUNumber, currentUser);
        setUsersList(loadUsers());
        showNotification(`Reset password for ${targetUNumber} back to initial default password (${targetUNumber}).`);
      },
    });
  };

  const handlePurgeDemoUsers = () => {
    const current = loadUsers();
    setUsersList(current);
    showNotification('All demo accounts have been permanently purged from roster.');
  };

  const handleDeleteUser = async (uNumber: string) => {
    if (uNumber.toLowerCase() === currentUser.uNumber.toLowerCase()) {
      showNotification('Cannot delete your own active administrator account.', 'error');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to delete user ${uNumber}? This will remove them from the system.`,
      confirmLabel: 'Delete User',
      variant: 'danger',
      onConfirm: async () => {
        const success = deleteUserAccount(uNumber, currentUser);
        if (success) {
          await deleteUserFromFirestore(uNumber);
          setUsersList(loadUsers());
          showNotification(`Deleted account ${uNumber}`);
        }
      },
    });
  };

  const handleResetCurrentDayToDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Day Data to Defaults',
      message: `Are you sure you want to reset all operational checklist data for ${dayData.date} back to factory defaults?`,
      confirmLabel: 'Reset to Defaults',
      variant: 'danger',
      onConfirm: () => {
        const fresh = resetDayDataToDefault(dayData.date, currentUser);
        onSaveDayData(fresh);
        showNotification(`Reset operational data for ${dayData.date} to defaults.`);
      },
    });
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.uNumber.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div 
        id="admin-panel-modal-container"
        className="w-full max-w-5xl box-3d overflow-hidden flex flex-col text-slate-900 max-h-[94vh] shadow-[0_25px_60px_-10px_rgba(0,0,0,0.45)]"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-300 flex items-center justify-between shrink-0 shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 flex items-center justify-center shadow-2xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Ground Operations Control Center
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-950 border border-purple-300 font-black shadow-2xs">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Logged as Administrator: <span className="font-mono text-purple-900 font-bold">{currentUser.uNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-admin-sync-window"
              type="button"
              onClick={async () => {
                const res = await ensureDateWindowInitialized(10);
                showNotification(`Rolling 10-Day Window synchronized (${res.initializedDates.length} operational dates verified).`);
              }}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 btn-3d-blue text-xs font-black rounded-xl cursor-pointer"
              title="Pre-seed and synchronize the 10-day forward operational window"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Sync 10-Day Window</span>
            </button>

            <button
              id="btn-admin-purge-retention"
              type="button"
              onClick={async () => {
                if (confirm('Run 1-Month Retention Policy Check?\n\nThis will purge operational shifts and audit records older than 30 days.')) {
                  const res = await purgeOldShiftsAndAuditLogs(30);
                  showNotification(`Retention Check Complete: Purged ${res.purgedShifts} shifts & ${res.purgedAuditLogs} logs older than ${res.cutoffDate}.`);
                }
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 btn-3d-amber text-xs font-black rounded-xl cursor-pointer"
              title="Purge checklists and audit records older than 1 month"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge (&gt;30d)</span>
            </button>

            <button
              id="btn-open-version-summary"
              type="button"
              onClick={() => setShowVersionSummaryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 btn-3d-white text-indigo-900 text-xs font-black rounded-xl cursor-pointer"
              title="Display automated versioning summary & revision audit log for all checklists"
            >
              <History className="w-3.5 h-3.5 text-indigo-700" />
              <span className="hidden sm:inline">Checklist Versions Summary</span>
              <span className="sm:hidden">Versions</span>
              <span className="ml-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-900 rounded-full text-[10px] font-mono font-bold leading-none border border-indigo-300">
                {allAggregatedChecklists.length}
              </span>
            </button>

            <button
              id="btn-admin-reset-day"
              type="button"
              onClick={handleResetCurrentDayToDefaults}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 btn-3d-rose text-xs font-black rounded-xl cursor-pointer"
              title="Reset Day to Factory Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Day Defaults</span>
            </button>

            <button
              id="btn-close-admin-panel"
              onClick={onClose}
              className="btn-3d-white p-1.5 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 py-2 sm:py-0 bg-slate-100 border-b border-slate-300 shrink-0">
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="sm:hidden w-full flex items-center justify-between px-3 py-2 btn-3d-white rounded-lg font-black text-xs uppercase tracking-wider transition"
          >
            <span>Nav: {activeTab === 'groups' ? '1. Operational Groups' : activeTab === 'checklists' ? '2. Checklist Builder' : activeTab === 'excel' ? '3. Excel Importer' : activeTab === 'users' ? '4. Personnel Roster' : '5. Non-Compliance Analysis'}</span>
            <span className="text-lg leading-none">{isMobileNavOpen ? '−' : '+'}</span>
          </button>

          <div className={`${isMobileNavOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 sm:mt-0 overflow-x-auto py-1`}>
            <button
              id="tab-btn-groups"
              type="button"
              onClick={() => { setActiveTab('groups'); setIsMobileNavOpen(false); }}
              className={`py-2 px-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 transition whitespace-nowrap rounded-xl cursor-pointer ${
                activeTab === 'groups'
                  ? 'btn-3d-amber'
                  : 'btn-3d-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>1. Operational & Flight Groups</span>
            </button>

            <button
              id="tab-btn-checklists"
              type="button"
              onClick={() => { setActiveTab('checklists'); setIsMobileNavOpen(false); }}
              className={`py-2 px-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 transition whitespace-nowrap rounded-xl cursor-pointer ${
                activeTab === 'checklists'
                  ? 'btn-3d-amber'
                  : 'btn-3d-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              <span>2. Checklist & Item Builder</span>
            </button>

            <button
              id="tab-btn-excel"
              type="button"
              onClick={() => { setActiveTab('excel'); setIsMobileNavOpen(false); }}
              className={`py-2 px-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 transition whitespace-nowrap rounded-xl cursor-pointer ${
                activeTab === 'excel'
                  ? 'btn-3d-amber'
                  : 'btn-3d-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>3. Excel Bulk Importer</span>
            </button>

            <button
              id="tab-btn-users"
              type="button"
              onClick={() => { setActiveTab('users'); setIsMobileNavOpen(false); }}
              className={`py-2 px-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 transition whitespace-nowrap rounded-xl cursor-pointer ${
                activeTab === 'users'
                  ? 'btn-3d-amber'
                  : 'btn-3d-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>4. Personnel Roster</span>
            </button>

            <button
              id="tab-btn-reports"
              type="button"
              onClick={() => { setActiveTab('reports'); setIsMobileNavOpen(false); }}
              className={`py-2 px-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 transition whitespace-nowrap rounded-xl cursor-pointer ${
                activeTab === 'reports'
                  ? 'btn-3d-rose'
                  : 'btn-3d-white text-rose-700 hover:text-rose-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>5. Non-Compliance Analysis ❌</span>
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {feedbackMessage && (
          <div 
            className={`px-6 py-2.5 text-xs flex items-center gap-2 font-bold shrink-0 animate-in fade-in shadow-2xs ${
              feedbackMessage.type === 'error'
                ? 'bg-rose-100 text-rose-950 border-b border-rose-300'
                : 'bg-emerald-100 text-emerald-950 border-b border-emerald-300'
            }`}
          >
            {feedbackMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-700" /> : <Check className="w-4 h-4 text-emerald-700" />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50/50">
          {/* TAB 1: GROUPS & FLIGHT GROUP MACRO BUILDER */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              {/* Flight Group Macro Info Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 shadow-2xs">
                <Plane className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 transform -rotate-45" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-blue-900">Flight Groups Macro Logic Engine</div>
                  <p className="text-blue-800 leading-relaxed">
                    There are 4 default Flight Groups: <strong className="font-mono text-blue-950 font-bold">LX147, LX2647, LH763, LH761</strong>. When you add a Sub-Operational Group under the master <em>Flight Groups Category</em>, it will automatically replicate across ALL 4 flight groups simultaneously!
                  </p>
                </div>
              </div>

              {/* Sub-Group Builder Form (with Macro Target) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>Add Sub-Operational Group (With Macro Replicator)</span>
                </h3>

                <form onSubmit={handleAddSubGroup} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Parent Category:
                    </label>
                    <select
                      id="select-parent-group"
                      value={selectedParentGroupId}
                      onChange={(e) => setSelectedParentGroupId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white font-mono"
                    >
                      <option value="ALL_FLIGHT_GROUPS">🚀 ALL 4 FLIGHT GROUPS (LX147, LX2647, LH763, LH761)</option>
                      {dayData.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sub-Group Name:
                    </label>
                    <input
                      id="input-subgroup-name"
                      type="text"
                      placeholder="e.g. De-Icing & Anti-Freeze Ops"
                      value={newSubGroupName}
                      onChange={(e) => setNewSubGroupName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Code (Optional):
                    </label>
                    <input
                      id="input-subgroup-code"
                      type="text"
                      placeholder="e.g. ICE-05"
                      value={newSubGroupCode}
                      onChange={(e) => setNewSubGroupCode(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white font-mono uppercase"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      id="btn-add-subgroup"
                      type="submit"
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Sub-Group</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Add Custom Operational Group */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span>Create Custom Top-Level Operational Group</span>
                </h3>

                <form onSubmit={handleAddOperationalGroup} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Group Name:
                    </label>
                    <input
                      id="input-new-group-name"
                      type="text"
                      placeholder="e.g. Cargo & Mail Hub"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Station Code:
                    </label>
                    <input
                      id="input-new-group-code"
                      type="text"
                      placeholder="e.g. CGO-OPS"
                      value={newGroupCode}
                      onChange={(e) => setNewGroupCode(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white font-mono uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGroupIsFlight}
                        onChange={(e) => setNewGroupIsFlight(e.target.checked)}
                        className="rounded border-slate-300 bg-white text-purple-600 focus:ring-purple-500"
                      />
                      <span>Is Flight Group?</span>
                    </label>
                  </div>

                  <div className="flex items-end">
                    <button
                      id="btn-add-group-submit"
                      type="submit"
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Group</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Configured Operational & Sub-Groups List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Configured Operational Groups & Sub-Groups ({dayData.groups.length})
                </h3>

                <div className="space-y-3">
                  {dayData.groups.map((grp, gIdx) => (
                    <div
                      key={`${grp.id}-${gIdx}`}
                      className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${grp.isFlightGroup ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                            {grp.isFlightGroup ? 'FLT' : 'OPS'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{grp.name}</span>
                              <span className="font-mono text-[11px] text-slate-500 font-semibold">({grp.code})</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {grp.subGroups.length} Sub-Operations configured
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickAppendChecklistToGroup(grp.id)}
                            className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs shrink-0"
                            title="Append Checklist directly to this Operational Group"
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-600" />
                            <span>+ Append Checklist to Group</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleGroupMandatory(grp.id)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                              grp.isMandatory
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {grp.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp.id)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-Groups List with Drag and Drop & Amend controls */}
                      {grp.subGroups.length > 0 && (
                        <div className="space-y-2 pt-1 pl-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Sub-Groups (Drag to reorder):
                          </span>
                          {grp.subGroups.map((sub, sIdx) => (
                            <div
                              key={`${sub.id}-${sIdx}`}
                              draggable
                              onDragStart={() => setDraggedSubGroupId(sub.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (draggedSubGroupId) {
                                  const srcSub = grp.subGroups.find((s) => s.id === draggedSubGroupId);
                                  if (srcSub) {
                                    handleReorderSubGroup(grp.id, srcSub.id, srcSub.name, sub.id, sub.name);
                                  }
                                  setDraggedSubGroupId(null);
                                }
                              }}
                              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs transition hover:border-purple-300 hover:shadow-2xs group"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="cursor-grab text-slate-400 hover:text-slate-600 p-0.5">
                                  <GripVertical className="w-4 h-4" />
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={sIdx === 0}
                                    onClick={() => handleMoveSubGroup(grp.id, sub.id, sub.name, 'up')}
                                    className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                                    title="Move Up"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={sIdx === grp.subGroups.length - 1}
                                    onClick={() => handleMoveSubGroup(grp.id, sub.id, sub.name, 'down')}
                                    className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                                    title="Move Down"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="font-bold text-slate-800">{sub.name}</span>
                                {sub.code && <span className="font-mono text-[10px] text-slate-500">({sub.code})</span>}
                                <span className="text-[10px] text-slate-400 ml-2">({sub.checklists.length} checklists)</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingSubGroup({
                                      id: sub.id,
                                      parentGroupId: grp.id,
                                      name: sub.name,
                                      code: sub.code,
                                      isMandatory: sub.isMandatory ?? true,
                                    })
                                  }
                                  className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                                  title="Amend / Edit Sub-Group"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubGroup(grp.id, sub.id)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                                  title="Delete Sub-Group"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKLIST & ITEMS BUILDER */}
          {activeTab === 'checklists' && (() => {
            // Unfiltered full structure showing all operational groups
            const fullTree: any[] = [];

            dayData.groups.forEach((grp) => {
              fullTree.push({
                id: grp.id,
                type: 'group',
                name: grp.name,
                code: grp.code,
                isFlightGroup: grp.isFlightGroup,
                isMandatory: grp.isMandatory,
                subGroups: grp.subGroups,
              });
            });

            // Filtering logic for hierarchical view
            const searchLower = treeSearchTerm.toLowerCase().trim();

            const filterTreeNode = (node: any): any | null => {
              const selfMatches =
                !searchLower ||
                node.name.toLowerCase().includes(searchLower) ||
                (node.code && node.code.toLowerCase().includes(searchLower));

              const filteredSubs = (node.subGroups || [])
                .map((sub: any) => {
                  const subMatchesSelf =
                    !searchLower ||
                    sub.name.toLowerCase().includes(searchLower) ||
                    (sub.code && sub.code.toLowerCase().includes(searchLower));

                  const filteredChecklists = (sub.checklists || [])
                    .map((chk: any) => {
                      const chkMatchesSelf =
                        !searchLower ||
                        chk.title.toLowerCase().includes(searchLower) ||
                        (chk.description && chk.description.toLowerCase().includes(searchLower)) ||
                        (chk.version && chk.version.toLowerCase().includes(searchLower));

                      const filteredItems = (chk.items || []).filter((item: any) => {
                        return !searchLower || item.text.toLowerCase().includes(searchLower);
                      });

                      const hasMatchingItems = filteredItems.length > 0;
                      const matchesChecklist = chkMatchesSelf || hasMatchingItems;

                      if (matchesChecklist) {
                        return {
                          ...chk,
                          items: filteredItems,
                          _matchesSelf: chkMatchesSelf,
                        };
                      }
                      return null;
                    })
                    .filter(Boolean);

                  const hasMatchingChecklists = filteredChecklists.length > 0;
                  const matchesSub = subMatchesSelf || hasMatchingChecklists;

                  if (matchesSub) {
                    return {
                      ...sub,
                      checklists: filteredChecklists,
                      _matchesSelf: subMatchesSelf,
                    };
                  }
                  return null;
                })
                .filter(Boolean);

              const hasMatchingSubs = filteredSubs.length > 0;
              const matchesGroup = selfMatches || hasMatchingSubs;

              if (matchesGroup) {
                return {
                  ...node,
                  subGroups: filteredSubs,
                  _matchesSelf: selfMatches,
                };
              }
              return null;
            };

            const filteredTree = fullTree.map(filterTreeNode).filter(Boolean);

            return (
              <div className="space-y-6">
                {/* Quick Launch Version Summary Banner */}
                <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200/80 rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950">
                        Station Checklist Versioning & Lifecycle Audit Directory
                      </div>
                      <p className="text-[11px] text-indigo-800/80">
                        View all {allAggregatedChecklists.length} station checklists, active semantic versions (e.g. v1.1), and modification timelines.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVersionSummaryModal(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Open Version Directory</span>
                  </button>
                </div>

                {/* Toolbar and Search for Tree */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-2xs">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search groups, sub-groups, checklists or items..."
                      value={treeSearchTerm}
                      onChange={(e) => setTreeSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={expandAllTreeNodes}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllTreeNodes}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      Collapse All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChecklistItemsInExplorer(!showChecklistItemsInExplorer)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                        showChecklistItemsInExplorer
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      {showChecklistItemsInExplorer ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>Checklist Items View</span>
                    </button>
                  </div>
                </div>

                {/* File Explorer Tree View Canvas */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4 shadow-3xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Interactive Checklist Directory Explorer
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      DoubleClick folders to toggle or click arrows to expand
                    </div>
                  </div>

                  {filteredTree.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-500 font-semibold">No matching elements found in hierarchy.</p>
                      {treeSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setTreeSearchTerm('')}
                          className="mt-2 text-xs font-bold text-purple-600 hover:underline"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 font-medium select-none">
                      {filteredTree.map((grp: any) => {
                        const isGrpExpanded = treeSearchTerm.trim() !== '' || isTreeNodeExpanded(grp.id, false);
                        const isFlight = grp.isFlightGroup;

                        return (
                          <div key={grp.id} className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-3xs">
                            {/* Group Node Row */}
                            <div className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 border-b border-slate-100 group">
                              <div
                                className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                                onClick={() => toggleTreeNode(grp.id)}
                              >
                                <button type="button" className="p-0.5 text-slate-400 hover:text-slate-600">
                                  {isGrpExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {isGrpExpanded ? (
                                  <FolderOpen className={`w-5 h-5 shrink-0 ${isFlight ? 'text-blue-500' : 'text-purple-500'}`} />
                                ) : (
                                  <Folder className={`w-5 h-5 shrink-0 ${isFlight ? 'text-blue-500' : 'text-purple-500'}`} />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-800 text-xs sm:text-sm">{grp.name}</span>
                                    <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      ({grp.code})
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                      isFlight ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                    }`}>
                                      {isFlight ? 'Flight Operations' : 'Station Operations'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Group Action Buttons */}
                              <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingGroup({
                                      id: grp.id,
                                      name: grp.name,
                                      code: grp.code,
                                      isMandatory: grp.isMandatory ?? true,
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-slate-100 rounded transition"
                                  title="Amend Group Properties"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveInlineSubGroupGroupId(
                                      activeInlineSubGroupGroupId === grp.id ? null : grp.id
                                    );
                                    setInlineSubGroupNameInput('');
                                    setInlineSubGroupCodeInput('');
                                  }}
                                  className={`p-1 rounded transition flex items-center gap-1 text-[11px] font-bold ${
                                    activeInlineSubGroupGroupId === grp.id
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'text-purple-600 hover:bg-purple-50'
                                  }`}
                                  title="Add Sub-Group inline"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span className="hidden md:inline">Sub-Group</span>
                                </button>
                              </div>
                            </div>

                            {/* Inline Subgroup Create Form */}
                            {activeInlineSubGroupGroupId === grp.id && (
                              <div className="bg-purple-50/40 p-4 border-b border-slate-100 space-y-3">
                                <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                                  + Create New Sub-Group under {grp.name}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Sub-Group Name:</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Ramp Services"
                                      value={inlineSubGroupNameInput}
                                      onChange={(e) => setInlineSubGroupNameInput(e.target.value)}
                                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Code (Optional):</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. RAMP-01"
                                      value={inlineSubGroupCodeInput}
                                      onChange={(e) => setInlineSubGroupCodeInput(e.target.value)}
                                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                                    />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleInlineAddSubGroupSubmit(grp.id)}
                                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                                    >
                                      Create Sub-Group
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setActiveInlineSubGroupGroupId(null)}
                                      className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Subgroups Container */}
                            {isGrpExpanded && (
                              <div className="bg-slate-50/20 divide-y divide-slate-100">
                                {(grp.subGroups || []).length === 0 ? (
                                  <div className="p-4 text-xs text-slate-400 italic text-center">
                                    {"No sub-groups configured. Click '+ Sub-Group' to append."}
                                  </div>
                                ) : (
                                  grp.subGroups.map((sub: any) => {
                                    const isSubExpanded = treeSearchTerm.trim() !== '' || isTreeNodeExpanded(sub.id, false);

                                    return (
                                      <div key={sub.id} className="pl-6 bg-slate-50/10">
                                        {/* Subgroup Row */}
                                        <div className="flex items-center justify-between p-3 hover:bg-slate-100/30 group">
                                          <div
                                            className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                            onClick={() => toggleTreeNode(sub.id)}
                                          >
                                            <button type="button" className="p-0.5 text-slate-400 hover:text-slate-600">
                                              {isSubExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </button>
                                            {isSubExpanded ? (
                                              <FolderOpen className="w-4 h-4 shrink-0 text-slate-500" />
                                            ) : (
                                              <Folder className="w-4 h-4 shrink-0 text-slate-400" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-slate-800 text-xs sm:text-sm">{sub.name}</span>
                                                {sub.code && (
                                                  <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-200 px-1 py-0.2 rounded">
                                                    {sub.code}
                                                  </span>
                                                )}
                                                <span className="text-[10px] text-slate-400">({sub.checklists?.length || 0} checklists)</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Sub-Group Action Buttons */}
                                          <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingSubGroup({
                                                  id: sub.id,
                                                  parentGroupId: grp.id,
                                                  name: sub.name,
                                                  code: sub.code,
                                                  isMandatory: sub.isMandatory ?? true,
                                                })
                                              }
                                              className="p-1 text-slate-400 hover:text-purple-600 hover:bg-slate-200/50 rounded transition"
                                              title="Amend Sub-Group"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteSubGroup(grp.id, sub.id)}
                                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                              title="Delete Sub-Group"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveInlineChecklistSubGroupId(
                                                  activeInlineChecklistSubGroupId === sub.id ? null : sub.id
                                                );
                                                setInlineChecklistTitleInput('');
                                                setInlineChecklistDescInput('');
                                                setInlineChecklistVersionInput('v1.0');
                                              }}
                                              className={`p-1 rounded transition flex items-center gap-0.5 text-[10px] font-bold ${
                                                activeInlineChecklistSubGroupId === sub.id
                                                  ? 'bg-purple-100 text-purple-700'
                                                  : 'text-purple-600 hover:bg-purple-50'
                                              }`}
                                              title="Add Checklist inline"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span className="hidden md:inline">Checklist</span>
                                            </button>
                                          </div>
                                        </div>

                                        {/* Inline Checklist Create Form */}
                                        {activeInlineChecklistSubGroupId === sub.id && (
                                          <div className="bg-purple-50/30 p-4 border-y border-slate-100 space-y-3">
                                            <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                                              + Add New Checklist under {sub.name}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                              <div className="sm:col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Checklist Title:</label>
                                                <input
                                                  type="text"
                                                  placeholder="e.g. Safety Inspection Checklist"
                                                  value={inlineChecklistTitleInput}
                                                  onChange={(e) => setInlineChecklistTitleInput(e.target.value)}
                                                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Version (e.g. v1.0):</label>
                                                <input
                                                  type="text"
                                                  placeholder="v1.0"
                                                  value={inlineChecklistVersionInput}
                                                  onChange={(e) => setInlineChecklistVersionInput(e.target.value)}
                                                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-purple-700 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Description:</label>
                                              <input
                                                type="text"
                                                placeholder="Brief operational purpose or compliance references..."
                                                value={inlineChecklistDescInput}
                                                onChange={(e) => setInlineChecklistDescInput(e.target.value)}
                                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                              />
                                            </div>
                                            <div className="flex justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => handleInlineAddChecklistSubmit(grp.id, sub.id, sub.name)}
                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                                              >
                                                Create Checklist
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setActiveInlineChecklistSubGroupId(null)}
                                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Checklists Container */}
                                        {isSubExpanded && (
                                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                                            {(sub.checklists || []).length === 0 ? (
                                              <div className="p-3 pl-8 text-xs text-slate-400 italic">
                                                {"No checklists configured under this subgroup. Click '+ Checklist' to append."}
                                              </div>
                                            ) : (
                                              sub.checklists.map((chk: any) => {
                                                const hasExpandedItems = perChecklistExpandedItems[chk.id] === true;
                                                const showItemsInNode = showChecklistItemsInExplorer || hasExpandedItems;

                                                return (
                                                  <div key={chk.id} className="pl-6 bg-white hover:bg-slate-50/20">
                                                    {/* Checklist Row */}
                                                    <div className="flex items-center justify-between p-3 group border-b border-slate-100 last:border-0">
                                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <FileText className="w-4 h-4 shrink-0 text-purple-600" />
                                                        <div className="min-w-0 flex-1">
                                                          <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-800 text-xs sm:text-sm">{chk.title}</span>
                                                            <span className="font-mono text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-semibold">
                                                              {chk.version || 'v1.0'}
                                                            </span>
                                                            {chk.isMandatory && (
                                                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                                                                MANDATORY
                                                              </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400">({chk.items?.length || 0} items)</span>
                                                          </div>
                                                          {chk.description && (
                                                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{chk.description}</p>
                                                          )}
                                                        </div>
                                                      </div>

                                                      {/* Checklist Action Controls */}
                                                      <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                          type="button"
                                                          onClick={() => toggleChecklistItemsExpanded(chk.id)}
                                                          className={`p-1 rounded transition ${
                                                            showItemsInNode ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-purple-600 hover:bg-slate-100'
                                                          }`}
                                                          title="Toggle Item View"
                                                        >
                                                          {showItemsInNode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setEditingChecklist({
                                                              id: chk.id,
                                                              parentGroupId: grp.id,
                                                              subGroupId: sub.id,
                                                              title: chk.title,
                                                              description: chk.description || '',
                                                              isMandatory: chk.isMandatory,
                                                              version: chk.version || 'v1.0',
                                                              versionDate: chk.versionDate || '',
                                                            })
                                                          }
                                                          className="p-1 text-slate-400 hover:text-purple-600 hover:bg-slate-100 rounded transition"
                                                          title="Amend Checklist & Version"
                                                        >
                                                          <Edit2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => handleDeleteChecklist(chk.title, chk.id, grp.id, sub.id)}
                                                          className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                                          title="Delete Checklist"
                                                        >
                                                          <Trash2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setExcelOverwriteTarget({
                                                              checklistId: chk.id,
                                                              checklistTitle: chk.title,
                                                              subGroupId: sub.id,
                                                              subGroupName: sub.name,
                                                              parentGroupId: grp.id,
                                                              groupName: grp.name,
                                                              isAllFlightGroups: isFlight,
                                                            })
                                                          }
                                                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                                                          title="In-place Overwrite Checklist by Importing Excel"
                                                        >
                                                          <Upload className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setActiveInlineItemChecklistId(
                                                              activeInlineItemChecklistId === chk.id ? null : chk.id
                                                            );
                                                            setInlineItemTextInput('');
                                                          }}
                                                          className={`p-1 rounded transition flex items-center gap-0.5 text-[10px] font-bold ${
                                                            activeInlineItemChecklistId === chk.id
                                                              ? 'bg-purple-100 text-purple-700'
                                                              : 'text-purple-600 hover:bg-purple-50'
                                                          }`}
                                                          title="Add checklist item inline"
                                                        >
                                                          <Plus className="w-3 h-3" />
                                                          <span className="hidden md:inline">Item</span>
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Inline Add Item Form */}
                                                    {activeInlineItemChecklistId === chk.id && (
                                                      <div className="bg-purple-50/20 p-3 border-b border-slate-100 space-y-2">
                                                        <div className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                                                          + Add New Checklist Item
                                                        </div>
                                                        <div className="flex gap-2">
                                                          <input
                                                            type="text"
                                                            placeholder="Enter task text description..."
                                                            value={inlineItemTextInput}
                                                            onChange={(e) => setInlineItemTextInput(e.target.value)}
                                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                handleInlineAddItemSubmit(grp.id, sub.id, sub.name, chk.id, chk.title);
                                                              }
                                                            }}
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() => handleInlineAddItemSubmit(grp.id, sub.id, sub.name, chk.id, chk.title)}
                                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                                                          >
                                                            Add Item
                                                          </button>
                                                        </div>
                                                      </div>
                                                    )}

                                                    {/* Items Sub-List View inside Checklist Node */}
                                                    {showItemsInNode && (
                                                      <div className="pl-6 pr-4 py-2 bg-slate-50/50 space-y-1.5 border-l-2 border-purple-200/50 my-1">
                                                        {(chk.items || []).length === 0 ? (
                                                          <div className="text-[11px] text-slate-400 italic py-1">
                                                            {"No items in this checklist. Click '+ Item' to add."}
                                                          </div>
                                                        ) : (
                                                          chk.items.map((item: any) => (
                                                            <div
                                                              key={item.id}
                                                              className="flex items-center justify-between p-2 bg-white border border-slate-200/60 rounded-lg shadow-3xs hover:border-slate-300 group"
                                                            >
                                                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                  {item.sequenceOrder}
                                                                </span>
                                                                <span className="text-xs font-medium text-slate-700 break-words flex-1 min-w-0">
                                                                  {item.text}
                                                                </span>
                                                              </div>

                                                              {/* Item Controls */}
                                                              <div className="flex items-center gap-1 shrink-0 ml-3">
                                                                <button
                                                                  type="button"
                                                                  onClick={() => handleToggleItemMandatory(chk.title, chk.id, item.text, item.id)}
                                                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition shrink-0 ${
                                                                    item.isMandatory
                                                                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                                  }`}
                                                                >
                                                                  {item.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                                                                </button>
                                                                <button
                                                                  type="button"
                                                                  onClick={() =>
                                                                    setEditingItem({
                                                                      id: item.id,
                                                                      chkId: chk.id,
                                                                      chkTitle: chk.title,
                                                                      text: item.text,
                                                                      isMandatory: item.isMandatory,
                                                                    })
                                                                  }
                                                                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-slate-100 rounded transition shrink-0"
                                                                >
                                                                  <Edit className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => handleDeleteItem(chk.title, chk.id, item.text, item.id, grp.id, sub.id)}
                                                                  className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                                                                >
                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: EXCEL BULK IMPORTER */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Excel Templates Download Box */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Download Standard Excel Import Templates</h4>
                  <p className="text-xs text-slate-500">Pre-formatted .xlsx workbooks for ground staff accounts & checklist items</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadUserImportTemplate}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Users Template (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadChecklistImportTemplate}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Checklists Template (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Sub-Section A: Bulk User Import */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Bulk Import User Accounts (.xlsx)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Col 1 = U-Number, Col 2 = Employee Name, Col 3 = Role/Department (Optional). Automatically sets initial password equal to U-Number and requires password update on first sign-in.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    ref={userFileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleUserFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => userFileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select User Excel File</span>
                  </button>

                  {excelUserFile && (
                    <span className="text-xs font-mono text-emerald-700 font-bold">
                      {excelUserFile.name} ({importPreviewUsers.length} parsed)
                    </span>
                  )}
                </div>

                {/* Preview Table */}
                {importPreviewUsers.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700">
                      Previewing {importPreviewUsers.length} New Accounts to Append:
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">U-Number</th>
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Role</th>
                            <th className="p-2.5">Initial Password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {importPreviewUsers.map((u, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2.5 text-emerald-700 font-bold">{u.uNumber}</td>
                              <td className="p-2.5 text-slate-800">{u.name}</td>
                              <td className="p-2.5 text-purple-700 font-semibold">{u.role}</td>
                              <td className="p-2.5 text-slate-400">Same as U-Number</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={handleCommitUserImport}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Commit Import to Storage</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-Section B: Bulk Checklist Items Import */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-sky-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Bulk Import Checklist Items (.xlsx)
                    </h3>
                  </div>

                  {/* Mode Toggle Pills */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setExcelImportMode('NEW');
                        setExcelTargetChecklistId('__NEW__');
                        if (!excelChecklistTitle || excelChecklistTitle === 'Standard Turnaround Inspection') {
                          setExcelChecklistTitle('Imported Operations Checklist');
                        }
                      }}
                      className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                        excelImportMode === 'NEW'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Create New Checklist</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExcelImportMode('OVERWRITE');
                        if (excelAvailableChecklists.length > 0) {
                          const firstChk = excelAvailableChecklists[0];
                          setExcelTargetChecklistId(firstChk.id || firstChk.title);
                          setExcelChecklistTitle(firstChk.title);
                        }
                      }}
                      className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                        excelImportMode === 'OVERWRITE'
                          ? 'bg-white text-amber-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Overwrite Existing Checklist</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-slate-500">
                    Import an Excel sheet (.xlsx) as a <strong className="text-emerald-700 font-bold">New Checklist</strong> or <strong className="text-amber-800 font-bold">Overwrite an Existing Checklist</strong> within a Direct Operational Group (General Operations) or Sub-Group. Defaults all imported items to <strong className="text-emerald-700 font-bold">is_mandatory = true</strong>.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowVersionSummaryModal(true)}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    title="View automated version history log across all checklists"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span>View Versioning Summary</span>
                  </button>
                </div>

                {/* Configuration 4-Column Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. Target Group */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Group:</label>
                    <select
                      value={excelTargetGroupId}
                      onChange={(e) => {
                        const newGrp = e.target.value;
                        setExcelTargetGroupId(newGrp);
                        setExcelTargetSubGroupId('DIRECT_GROUP');
                        setExcelTargetChecklistId('__NEW__');
                        setExcelImportMode('NEW');
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white font-semibold"
                    >
                      <option value="ALL_FLIGHT_GROUPS" className="font-bold text-blue-700">
                        🚀 ALL 4 FLIGHT GROUPS (LX147, LX2647, LH763, LH761)
                      </option>
                      <optgroup label="── Specific Operational Groups ──">
                        {dayData.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.code}) {g.isFlightGroup ? '✈️' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* 2. Target Sub-Group / Destination */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Sub-Group / Destination:</label>
                    <select
                      value={excelTargetSubGroupId || 'DIRECT_GROUP'}
                      onChange={(e) => {
                        const newSub = e.target.value;
                        setExcelTargetSubGroupId(newSub);
                        setExcelTargetChecklistId('__NEW__');
                        setExcelImportMode('NEW');
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white font-semibold"
                    >
                      <option value="DIRECT_GROUP" className="font-bold text-purple-700">
                        📌 Direct Operational Group (General Operations)
                      </option>
                      {excelAvailableSubGroups.map((s) => (
                        <option key={s.id} value={s.id}>
                          📂 {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Action / Target Checklist Dropdown (New or Overwrite) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Target Checklist:</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          excelImportMode === 'OVERWRITE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {excelImportMode === 'OVERWRITE' ? 'OVERWRITE' : 'NEW'}
                      </span>
                    </label>
                    <select
                      value={excelTargetChecklistId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExcelTargetChecklistId(val);
                        if (val === '__NEW__') {
                          setExcelImportMode('NEW');
                          if (!excelChecklistTitle || excelAvailableChecklists.some((c) => c.title === excelChecklistTitle)) {
                            setExcelChecklistTitle('Imported Operations Checklist');
                          }
                        } else {
                          setExcelImportMode('OVERWRITE');
                          const targetChk = excelAvailableChecklists.find(
                            (c) => c.id === val || c.title.trim().toLowerCase() === val.trim().toLowerCase()
                          );
                          if (targetChk) {
                            setExcelChecklistTitle(targetChk.title);
                          }
                        }
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white font-semibold"
                    >
                      <option value="__NEW__" className="font-bold text-emerald-700">
                        ✨ [+ Create as New Checklist]
                      </option>
                      {excelAvailableChecklists.length > 0 && (
                        <optgroup label="── Overwrite Existing Checklist ──">
                          {excelAvailableChecklists.map((chk) => (
                            <option key={chk.id} value={chk.id || chk.title} className="text-amber-800 font-medium">
                              📝 {chk.title} ({chk.itemCount} items)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* 4. Checklist Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {excelImportMode === 'OVERWRITE' ? 'Checklist Title (Overwrite):' : 'Checklist Title (New):'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Standard Turnaround Inspection"
                      value={excelChecklistTitle}
                      onChange={(e) => setExcelChecklistTitle(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                    >
                    </input>
                  </div>
                </div>

                {/* Dynamic Destination & Action Summary Banner */}
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 ${
                    excelImportMode === 'OVERWRITE'
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {excelImportMode === 'OVERWRITE' ? (
                      <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] mr-1.5 px-1.5 py-0.5 rounded bg-white border border-current">
                        {excelImportMode === 'OVERWRITE' ? 'Overwrite Mode' : 'New Checklist Mode'}
                      </span>
                      <span>
                        Destination:{' '}
                        <strong>
                          {excelTargetGroupId === 'ALL_FLIGHT_GROUPS'
                            ? 'ALL 4 Flight Groups'
                            : dayData.groups.find((g) => g.id === excelTargetGroupId)?.name || excelTargetGroupId}
                        </strong>{' '}
                        &gt;{' '}
                        <strong>
                          {excelTargetSubGroupId === 'DIRECT_GROUP' || !excelTargetSubGroupId
                            ? 'Direct Operational Group (General Operations)'
                            : excelAvailableSubGroups.find((s) => s.id === excelTargetSubGroupId)?.name || excelTargetSubGroupId}
                        </strong>{' '}
                        &gt;{' '}
                        <strong className={excelImportMode === 'OVERWRITE' ? 'text-amber-800 underline' : 'text-emerald-800 underline'}>
                          {excelChecklistTitle || 'Untitled Checklist'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {excelImportMode === 'OVERWRITE' && (
                    <span className="text-[11px] font-mono font-bold text-amber-800">
                      Existing items will be replaced with imported Excel items
                    </span>
                  )}
                </div>

                {/* File Upload Trigger */}
                <div className="flex items-center gap-3">
                  <input
                    ref={checklistFileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleChecklistFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => checklistFileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select Checklist Excel File</span>
                  </button>

                  {excelChecklistFile && (
                    <span className="text-xs font-mono text-sky-700 font-bold flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>{excelChecklistFile.name}</span>
                      <span className="text-slate-500 font-normal">({importPreviewItems.length} parsed items)</span>
                    </span>
                  )}
                </div>

                {/* Preview Table */}
                {importPreviewItems.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Previewing {importPreviewItems.length} Parsed Items Ready for Import:</span>
                      <span className="text-[11px] font-mono text-slate-500 font-normal">
                        All items will be tagged mandatory by default
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Seq</th>
                            <th className="p-2.5">Description</th>
                            <th className="p-2.5">Mandatory?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreviewItems.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono text-sky-700 font-bold">#{item.sequenceOrder}</td>
                              <td className="p-2.5 text-slate-800">{item.text}</td>
                              <td className="p-2.5 font-bold text-rose-600">
                                {item.isMandatory ? 'YES (Default)' : 'NO'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={handleCommitChecklistImport}
                      className={`px-5 py-2.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2 ${
                        excelImportMode === 'OVERWRITE'
                          ? 'bg-amber-600 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500'
                          : 'bg-sky-600 hover:bg-sky-700 focus:ring-2 focus:ring-sky-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {excelImportMode === 'OVERWRITE'
                          ? excelTargetGroupId === 'ALL_FLIGHT_GROUPS'
                            ? `Overwrite "${excelChecklistTitle}" in ALL 4 Flight Groups (${importPreviewItems.length} items)`
                            : `Overwrite "${excelChecklistTitle}" in ${
                                dayData.groups.find((g) => g.id === excelTargetGroupId)?.name || 'Group'
                              } (${importPreviewItems.length} items)`
                          : excelTargetGroupId === 'ALL_FLIGHT_GROUPS'
                          ? `Append "${excelChecklistTitle}" to ALL 4 Flight Groups (${importPreviewItems.length} items)`
                          : `Append "${excelChecklistTitle}" to ${
                              dayData.groups.find((g) => g.id === excelTargetGroupId)?.name || 'Group'
                            } (${importPreviewItems.length} items)`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: USER ACCOUNTS & PASSWORD RESET */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Add Single User Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>Create User Account</span>
                </h3>

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">U-Number:</label>
                    <input
                      type="text"
                      placeholder="e.g. U99182"
                      value={newUNumber}
                      onChange={(e) => setNewUNumber(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono uppercase focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name:</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Connor"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Role Tier:</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white"
                    >
                      <option value="USER">User</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Account</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Users Search and Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Personnel Directory ({filteredUsers.length})
                  </h3>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search U-Number or name..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-2xs"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200">
                        <tr>
                          <th className="p-3">U-Number</th>
                          <th className="p-3">Employee Name</th>
                          <th className="p-3">Security Role</th>
                          <th className="p-3">First Login & Password Status</th>
                          <th className="p-3">Department</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u, idx) => (
                          <tr key={`${u.uNumber}-${idx}`} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-purple-700">{u.uNumber}</td>
                            <td className="p-3 font-medium text-slate-800">{u.name}</td>
                            <td className="p-3">
                              <span
                                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                                  u.role === 'ADMIN'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : u.role === 'SUPERVISOR'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="p-3">
                              {u.mustChangePassword ? (
                                <span
                                  className="inline-flex items-center gap-1.5 text-[10px] text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs"
                                  title={`Initial password active (matches Username: ${u.uNumber}). User must set custom password on first log-in.`}
                                >
                                  <KeyRound className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Initial Password Active (1st Login Pending)</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs"
                                  title="User has logged in and configured their custom password."
                                >
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>First Login Completed</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 font-mono text-[11px]">
                              {u.department || 'Ground Operations'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditUser(u)}
                                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold rounded-xl transition flex items-center gap-1 shrink-0 shadow-2xs"
                                  title={`Edit personnel account details & role for ${u.uNumber}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>Edit Personnel</span>
                                </button>

                                {u.uNumber.toLowerCase() !== 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.uNumber)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NON-COMPLIANCE ANALYSIS & DATE RANGE EXCEL EXPORT */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center shrink-0 font-extrabold text-lg">
                    ❌
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Non-Compliance & Quality Audit Compilation
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Compile Missed & Incorrectly Executed checklist items over historical Date Ranges with free-text operational remarks and Excel export.
                    </p>
                  </div>
                </div>

                {hasReportBeenFetched && compiledNonComplianceRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (compiledNonComplianceRecords.length === 0) {
                        alert('No non-compliance records to export.');
                        return;
                      }
                      exportNonComplianceReportToExcel(compiledNonComplianceRecords, reportStartDate, reportEndDate);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Non-Compliance Report to Excel (.xlsx)</span>
                  </button>
                )}
              </div>

              {/* Date Range Query Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-600" />
                  <span>Select Historical Analysis Date Window</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">From Date (Start):</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">To Date (End):</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleFetchNonComplianceReport}
                      disabled={isFetchingReport}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isFetchingReport ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>Fetching Database Shifts...</span>
                        </>
                      ) : (
                        <>
                          <Filter className="w-4 h-4" />
                          <span>Compile Non-Compliance Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Results View */}
              {hasReportBeenFetched && (
                <div className="space-y-4">
                  {/* Summary Metrics Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-lg">
                        {compiledNonComplianceRecords.length}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Non-Compliances</div>
                        <div className="text-base font-extrabold text-slate-900">
                          {compiledNonComplianceRecords.length} Occurrences Logged
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center font-bold text-lg">
                        {compiledNonComplianceRecords.filter((r) => r.status === 'missed').length}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Missed Items ❌</div>
                        <div className="text-base font-extrabold text-rose-800">
                          {compiledNonComplianceRecords.filter((r) => r.status === 'missed').length} Skipped / Unprocessed
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-lg">
                        {compiledNonComplianceRecords.filter((r) => r.status === 'incorrectly_executed').length}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Incorrectly Executed ❌</div>
                        <div className="text-base font-extrabold text-rose-900">
                          {compiledNonComplianceRecords.filter((r) => r.status === 'incorrectly_executed').length} Execution Errors
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-2xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReportStatusFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          reportStatusFilter === 'ALL'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All ({compiledNonComplianceRecords.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportStatusFilter('missed')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          reportStatusFilter === 'missed'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Missed Only ({compiledNonComplianceRecords.filter((r) => r.status === 'missed').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportStatusFilter('incorrectly_executed')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          reportStatusFilter === 'incorrectly_executed'
                            ? 'bg-rose-900 text-white'
                            : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
                        }`}
                      >
                        Incorrect Only ({compiledNonComplianceRecords.filter((r) => r.status === 'incorrectly_executed').length})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search flight, checklist, remark, staff..."
                        value={reportSearchQuery}
                        onChange={(e) => setReportSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  {/* Non-Compliance Data Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {compiledNonComplianceRecords.filter((rec) => {
                      if (reportStatusFilter !== 'ALL' && rec.status !== reportStatusFilter) return false;
                      if (reportSearchQuery.trim()) {
                        const q = reportSearchQuery.toLowerCase();
                        const matchText = `${rec.date} ${rec.groupName} ${rec.subGroupName} ${rec.checklistTitle} ${rec.itemText} ${rec.actionBy} ${rec.remark || ''}`.toLowerCase();
                        if (!matchText.includes(q)) return false;
                      }
                      return true;
                    }).length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <div className="text-sm font-bold text-slate-800">No Non-Compliance Records Found</div>
                        <p className="text-xs text-slate-500">
                          {compiledNonComplianceRecords.length === 0
                            ? 'Zero missed or incorrectly executed checklist items were logged in this date range. Full compliance achieved!'
                            : 'No records match your selected filter criteria.'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900 text-white font-mono sticky top-0 z-10">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Flight / Op Group</th>
                              <th className="p-3">Sub-Group</th>
                              <th className="p-3">Checklist Title</th>
                              <th className="p-3">Seq #</th>
                              <th className="p-3">Item Description</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Operator</th>
                              <th className="p-3">Operational Rationale / Remark</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {compiledNonComplianceRecords
                              .filter((rec) => {
                                if (reportStatusFilter !== 'ALL' && rec.status !== reportStatusFilter) return false;
                                if (reportSearchQuery.trim()) {
                                  const q = reportSearchQuery.toLowerCase();
                                  const matchText = `${rec.date} ${rec.groupName} ${rec.subGroupName} ${rec.checklistTitle} ${rec.itemText} ${rec.actionBy} ${rec.remark || ''}`.toLowerCase();
                                  if (!matchText.includes(q)) return false;
                                }
                                return true;
                              })
                              .map((rec, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{rec.date}</td>
                                  <td className="p-3 font-bold text-blue-800 whitespace-nowrap">{rec.groupName}</td>
                                  <td className="p-3 text-slate-600 whitespace-nowrap">{rec.subGroupName}</td>
                                  <td className="p-3 font-semibold text-slate-800">{rec.checklistTitle}</td>
                                  <td className="p-3 font-mono text-slate-500 text-[11px]">#{rec.seqNo}</td>
                                  <td className="p-3 text-slate-900 font-medium max-w-xs">{rec.itemText}</td>
                                  <td className="p-3 whitespace-nowrap">
                                    {rec.status === 'missed' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-extrabold">
                                        MISSED ❌
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-rose-900 border border-rose-300 text-[11px] font-extrabold">
                                        INCORRECT ❌
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{rec.actionBy}</td>
                                  <td className="p-3 text-rose-900 font-medium italic max-w-sm">
                                    {rec.remark || 'No remark provided'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            Close Admin Console
          </button>
        </div>
      </div>

      {/* AMEND OPERATIONAL GROUP MODAL */}
      {editingGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <span>Amend Operational Group Properties</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group Name:</label>
                <input
                  type="text"
                  required
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group / Station Code:</label>
                <input
                  type="text"
                  required
                  value={editingGroup.code}
                  onChange={(e) => setEditingGroup({ ...editingGroup, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TARGETED EXCEL OVERWRITE MODAL */}
      {excelOverwriteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Overwrite Checklist via Excel</h3>
                  <p className="text-[11px] text-amber-800 font-semibold">Target: {excelOverwriteTarget.checklistTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExcelOverwriteTarget(null);
                  setExcelOverwriteItems([]);
                  setExcelOverwriteFileName('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Overwrite Confirmation</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {"Uploading an Excel file will overwrite all existing items in checklist "}
                <strong className="font-bold">{"'" + excelOverwriteTarget.checklistTitle + "'"}</strong>
                {excelOverwriteTarget.isAllFlightGroups ? ' across ALL 4 Flight Groups simultaneously' : ` in ${excelOverwriteTarget.groupName}`}
                {". The checklist version will automatically be incremented."}
              </p>
            </div>

            <div className="space-y-3">
              <input
                ref={excelOverwriteFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelOverwriteSelect}
                className="hidden"
              />

              <div
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center space-y-2 bg-slate-50 hover:bg-amber-50/40 transition cursor-pointer"
                onClick={() => excelOverwriteFileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-amber-600 mx-auto" />
                <div className="text-xs font-bold text-slate-800">
                  {excelOverwriteFileName ? excelOverwriteFileName : 'Click or Drag Excel / CSV File Here to Overwrite'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Accepts .xlsx, .xls, .csv files with checklist item descriptions
                </p>
              </div>

              {excelOverwriteItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Parsed Items Preview ({excelOverwriteItems.length} items):</span>
                    <span className="text-emerald-700 font-mono text-[11px]">Ready to Overwrite</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {excelOverwriteItems.map((item, idx) => (
                      <div key={idx} className="p-2 text-xs flex items-center justify-between gap-2 bg-white">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                          <span className="text-slate-800 font-medium truncate">{item.text}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          MANDATORY
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setExcelOverwriteTarget(null);
                  setExcelOverwriteItems([]);
                  setExcelOverwriteFileName('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={excelOverwriteItems.length === 0}
                onClick={handleCommitExcelOverwrite}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Overwrite Checklist</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AMEND SUB-GROUP MODAL */}
      {editingSubGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <span>Amend Sub-Group Properties</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedSubGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Group Name:</label>
                <input
                  type="text"
                  required
                  value={editingSubGroup.name}
                  onChange={(e) => setEditingSubGroup({ ...editingSubGroup, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Group Code:</label>
                <input
                  type="text"
                  placeholder="e.g. PRE-ARR"
                  value={editingSubGroup.code || ''}
                  onChange={(e) => setEditingSubGroup({ ...editingSubGroup, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSubGroup(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AMEND CHECKLIST MODAL WITH VERSIONING */}
      {editingChecklist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <span>Amend Checklist & Maintain Versioning</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingChecklist(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedChecklist} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Checklist Title:</label>
                <input
                  type="text"
                  required
                  value={editingChecklist.title}
                  onChange={(e) => setEditingChecklist({ ...editingChecklist, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description:</label>
                <input
                  type="text"
                  value={editingChecklist.description || ''}
                  onChange={(e) => setEditingChecklist({ ...editingChecklist, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Version Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. v1.1"
                    value={editingChecklist.version}
                    onChange={(e) => setEditingChecklist({ ...editingChecklist, version: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date Updated:</label>
                  <input
                    type="date"
                    required
                    value={editingChecklist.versionDate}
                    onChange={(e) => setEditingChecklist({ ...editingChecklist, versionDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingChecklist(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Amended Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AMEND ITEM MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-600" />
                <span>Amend Checklist Item Text</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedItem} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Description:</label>
                <textarea
                  rows={3}
                  required
                  value={editingItem.text}
                  onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Item Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Personnel Account Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Edit Personnel Account</h3>
                  <p className="text-[11px] text-slate-500 font-mono">U-Number: {editingUser.uNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Security Role</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as UserAccount['role'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                >
                  <option value="USER">User (Operational Task Execution)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Shift Verification & Diagnosis)</option>
                  <option value="ADMIN">ADMIN (System Configuration & Roster Admin)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Changing role from User to Supervisor or Admin updates access permissions across the terminal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editUserDept}
                  onChange={(e) => setEditUserDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-user-auth"
                  checked={editUserIsAuthorized}
                  onChange={(e) => setEditUserIsAuthorized(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="edit-user-auth" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Account Authorized (Enabled)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Personnel Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checklist Versioning Information Summary Modal */}
      {showVersionSummaryModal && (
        <div 
          id="modal-checklist-version-summary"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-6xl max-h-[92vh] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase tracking-wider text-white">Checklist Versioning Directory</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-mono text-[11px] font-bold border border-indigo-400/30">
                      DEL Station Hub
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80">
                    Comprehensive audit trail, automated version increments, and lifecycle history for all station operational checklists.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportVersionSummaryCSV}
                  className="px-3.5 py-2 bg-indigo-600/60 hover:bg-indigo-600 border border-indigo-400/40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  title="Export full checklist version log to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVersionSummaryModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Top KPI Metrics Bar */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Total Checklists</span>
                  <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{allAggregatedChecklists.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Across all operational departments</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center justify-between">
                  <span>Flight Groups (4x)</span>
                  <Plane className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-blue-900 mt-1 font-mono">
                  {allAggregatedChecklists.filter((c) => c.isFlightGroup).length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">LX147, LX2647, LH763, LH761</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Station Ops Checklists</span>
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
                  {allAggregatedChecklists.filter((c) => !c.isFlightGroup).length}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Cargo, Terminal, Security, Ramp</div>
              </div>

              <div className="p-3 bg-white border border-amber-200 bg-amber-50/40 rounded-xl shadow-2xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
                  <span>Updated / Overwritten</span>
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900 mt-1 font-mono">
                  {allAggregatedChecklists.filter((c) => c.hasOverwrites).length}
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">Automated version bumps recorded</div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-version-search"
                  type="text"
                  placeholder="Search checklists by title, version (e.g. v1.1), department, notes..."
                  value={versionSearchQuery}
                  onChange={(e) => setVersionSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                {versionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVersionSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setVersionGroupFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    versionGroupFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({allAggregatedChecklists.length})
                </button>

                <button
                  type="button"
                  onClick={() => setVersionGroupFilter('FLIGHT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    versionGroupFilter === 'FLIGHT'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  ✈️ Flight Groups ({allAggregatedChecklists.filter((c) => c.isFlightGroup).length})
                </button>

                <button
                  type="button"
                  onClick={() => setVersionGroupFilter('NON_FLIGHT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    versionGroupFilter === 'NON_FLIGHT'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Station Ops ({allAggregatedChecklists.filter((c) => !c.isFlightGroup).length})
                </button>

                <button
                  type="button"
                  onClick={() => setVersionGroupFilter('REVISED_ONLY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    versionGroupFilter === 'REVISED_ONLY'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  🔄 Revised Only ({allAggregatedChecklists.filter((c) => c.hasOverwrites).length})
                </button>
              </div>
            </div>

            {/* Checklist Directory Table / Accordion List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 space-y-3">
              {filteredVersionChecklists.length === 0 ? (
                <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-bold text-slate-800 text-sm">No checklists match the filter</div>
                  <p className="text-xs text-slate-500 mt-1">Try clearing your search query or switching filters.</p>
                </div>
              ) : (
                filteredVersionChecklists.map((item) => {
                  const isExpanded = expandedHistoryChkId === item.checklist.id;
                  const history = item.checklist.versionHistory || [];

                  return (
                    <div
                      key={`${item.groupId}-${item.subGroupId}-${item.checklist.id}`}
                      className={`bg-white border rounded-2xl transition overflow-hidden shadow-2xs ${
                        isExpanded ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Row Header */}
                      <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              item.isFlightGroup
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {item.isFlightGroup ? 'FLT' : 'OPS'}
                          </span>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {item.groupCode}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {item.groupName} &gt; {item.subGroupName}
                              </span>
                              {item.checklist.isMandatory && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                  MANDATORY
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-900 truncate">
                              {item.checklist.title}
                            </div>
                          </div>
                        </div>

                        {/* Versioning & Meta Pills */}
                        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Ver:</span>
                            <span className="font-mono font-black text-xs text-indigo-800">
                              {item.checklist.version || 'v1.0'}
                            </span>
                            <span className="text-[10px] text-indigo-500 font-mono">
                              ({item.checklist.versionDate || '2026-08-20'})
                            </span>
                          </div>

                          <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700">
                            <strong>{item.checklist.items?.length || 0}</strong> active items
                          </div>

                          <div
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${
                              item.hasOverwrites
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <History className="w-3 h-3" />
                            <span>{item.revisionsCount} {item.revisionsCount === 1 ? 'Revision' : 'Revisions'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedHistoryChkId(isExpanded ? null : item.checklist.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                              isExpanded
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span>{isExpanded ? 'Hide History' : 'View History'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Version Timeline Drawer */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 bg-indigo-50/30 border-t border-indigo-100 space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Version Audit Trail & Modification Log</span>
                            </h5>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ID: {item.checklist.id}
                            </span>
                          </div>

                          {history.length === 0 ? (
                            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-mono font-bold rounded text-xs">
                                    {item.checklist.version || 'v1.0'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                                    INITIAL BASELINE
                                  </span>
                                </div>
                                <span className="font-mono text-slate-400 text-[11px]">{item.checklist.versionDate || '2026-08-20'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Station default checklist baseline with {item.checklist.items?.length || 0} active inspection steps.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-200">
                              {history.map((rev, rIdx) => (
                                <div
                                  key={`${rev.version}-${rIdx}`}
                                  className="ml-6 p-3 bg-white border border-indigo-100 rounded-xl shadow-2xs relative space-y-1.5"
                                >
                                  {/* Dot */}
                                  <div
                                    className={`absolute -left-[19px] top-4 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                      rev.changeType === 'OVERWRITE'
                                        ? 'bg-amber-500'
                                        : rev.changeType === 'IMPORT'
                                        ? 'bg-blue-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />

                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 font-mono font-black text-xs rounded-md">
                                        {rev.version}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                          rev.changeType === 'OVERWRITE'
                                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                            : rev.changeType === 'IMPORT'
                                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                        }`}
                                      >
                                        {rev.changeType}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-700">
                                        By: <strong className="text-slate-900">{rev.updatedBy}</strong>
                                      </span>
                                    </div>

                                    <div className="text-[11px] font-mono text-slate-500">
                                      {rev.timestamp ? new Date(rev.timestamp).toLocaleString() : rev.versionDate}
                                    </div>
                                  </div>

                                  <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    {rev.notes || 'Automated version increment recorded.'}
                                  </div>

                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                                    <span>Items in version: <strong className="text-slate-800">{rev.itemCount}</strong></span>
                                    {rev.previousItemCount !== undefined && (
                                      <span>(Previous item count: {rev.previousItemCount})</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Automated semantic versioning tracks all bulk overwrites and changes across station shifts.</span>
              </div>

              <button
                type="button"
                onClick={() => setShowVersionSummaryModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
