'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  DayOperationalData, 
  OperationalGroup, 
  SubOperationalGroup, 
  Checklist, 
  ChecklistItem, 
  UserAccount 
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
  subscribeUsers
} from '@/lib/storage';
import { fetchUsersFromFirestore, subscribeToUsersFromFirestore, saveUserToFirestore, saveUsersToFirestoreBatch, deleteUserFromFirestore } from '@/lib/firestoreService';
import { makeItem, FLIGHT_CODES } from '@/lib/initialData';
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
  FileText
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  dayData: DayOperationalData;
  currentUser: UserAccount;
  onClose: () => void;
  onSaveDayData: (data: DayOperationalData) => void;
}

type AdminTab = 'groups' | 'checklists' | 'excel' | 'users';

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
  const [excelTargetGroupId, setExcelTargetGroupId] = useState<string>('ALL_FLIGHT_GROUPS');
  const [excelTargetSubGroupId, setExcelTargetSubGroupId] = useState<string>('');
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

  const userFileInputRef = useRef<HTMLInputElement>(null);
  const checklistFileInputRef = useRef<HTMLInputElement>(null);

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
    if (!window.confirm('Are you sure you want to delete this Operational Group? This cannot be undone.')) return;
    const updatedGroups = dayData.groups.filter((g) => g.id !== groupId);
    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification('Group deleted');
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
    if (!window.confirm('Are you sure you want to delete this Sub-Operational Group? This cannot be undone.')) return;
    const updatedGroups = dayData.groups.map((grp) => {
      if (grp.id === groupId) {
        return {
          ...grp,
          subGroups: grp.subGroups.filter((s) => s.id !== subId),
        };
      }
      return grp;
    });
    onSaveDayData({ ...dayData, groups: updatedGroups });
    showNotification('Sub-group deleted');
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
    selectedEditSubGroup = generalSubGroup || {
      id: 'DIRECT_GROUP',
      name: 'General Operations',
      code: selectedEditGroup?.code || 'GEN',
      checklists: selectedEditGroup
        ? selectedEditGroup.subGroups.flatMap((s) => s.checklists)
        : [],
    };
  } else {
    selectedEditSubGroup =
      activeSubGroups.find((s) => s.id === selectedEditSubGroupId || s.name.trim().toLowerCase() === selectedEditSubGroupId.trim().toLowerCase()) ||
      activeSubGroups[0];
  }

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

  const handleDeleteChecklist = (chkTitle: string, chkId: string) => {
    if (!window.confirm(`Are you sure you want to delete the checklist "${chkTitle}"? This cannot be undone.`)) return;
    if (!selectedEditSubGroup) return;
    const targetSubName = selectedEditSubGroup.name.trim().toLowerCase();

    if (isAllFlightGroups) {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.name.trim().toLowerCase() === targetSubName) {
                return {
                  ...sub,
                  checklists: sub.checklists.filter((c) => c.title.trim().toLowerCase() !== chkTitle.trim().toLowerCase() && c.id !== chkId),
                };
              }
              return sub;
            }),
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Deleted Checklist "${chkTitle}" from ALL 4 Flight Groups`);
    } else {
      if (!selectedEditGroup) return;
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === selectedEditGroup.id) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === selectedEditSubGroup.id) {
                return {
                  ...sub,
                  checklists: sub.checklists.filter((c) => c.id !== chkId),
                };
              }
              return sub;
            }),
          };
        }
        return grp;
      });
      onSaveDayData({ ...dayData, groups: updatedGroups });
      showNotification(`Checklist "${chkTitle}" deleted`);
    }
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
              if (sub.name.trim().toLowerCase() === targetSubName) {
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
              if (sub.id === selectedEditSubGroup.id) {
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
              if (sub.name.trim().toLowerCase() === targetSubName) {
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
              if (sub.id === selectedEditSubGroup.id) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.id === chkId) {
                      return {
                        ...chk,
                        items: chk.items.map((item) => {
                          if (item.id === itemId) return { ...item, isMandatory: !item.isMandatory };
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

  const handleDeleteItem = (chkTitle: string, chkId: string, itemText: string, itemId: string) => {
    if (!window.confirm(`Are you sure you want to delete the item "${itemText}" from the checklist? This cannot be undone.`)) return;
    if (!selectedEditSubGroup) return;
    const targetSubName = selectedEditSubGroup.name.trim().toLowerCase();

    if (isAllFlightGroups) {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.name.trim().toLowerCase() === targetSubName) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.title.trim().toLowerCase() === chkTitle.trim().toLowerCase() || chk.id === chkId) {
                      return {
                        ...chk,
                        items: chk.items.filter((i) => i.text.trim() !== itemText.trim() && i.id !== itemId),
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
      if (!selectedEditGroup) return;
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === selectedEditGroup.id) {
          return {
            ...grp,
            subGroups: grp.subGroups.map((sub) => {
              if (sub.id === selectedEditSubGroup.id) {
                return {
                  ...sub,
                  checklists: sub.checklists.map((chk) => {
                    if (chk.id === chkId) {
                      return {
                        ...chk,
                        items: chk.items.filter((i) => i.id !== itemId),
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
      showNotification('Please select target Group and Sub-Group to append items', 'error');
      return;
    }

    const isExcelAllFlightGroups = excelTargetGroupId === 'ALL_FLIGHT_GROUPS';
    const isDirectGroup = !excelTargetSubGroupId || excelTargetSubGroupId === 'DIRECT_GROUP';
    const targetSubName = (isDirectGroup ? 'General Operations' : excelTargetSubGroupId).trim().toLowerCase();

    if (isExcelAllFlightGroups) {
      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.isFlightGroup) {
          const newChecklist: Checklist = {
            id: `chk-imp-${grp.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: excelChecklistTitle.trim() || 'Imported Excel Checklist',
            isMandatory: true,
            status: 'pending',
            version: 'v1.0',
            versionDate: new Date().toISOString().split('T')[0],
            items: importPreviewItems.map((item, idx) => ({
              ...item,
              id: `item-imp-${grp.code.toLowerCase()}-${Date.now()}-${idx}`,
            })),
          };

          const hasSub = grp.subGroups.some((s) => s.name.trim().toLowerCase() === targetSubName || s.id === excelTargetSubGroupId);
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
        return grp;
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setImportPreviewItems([]);
      setExcelChecklistFile(null);
      showNotification(`Appended ${importPreviewItems.length} checklist items to ALL 4 Flight Groups simultaneously under "${excelChecklistTitle}"!`);
    } else {
      const newChecklist: Checklist = {
        id: generateUniqueId('chk-imp'),
        title: excelChecklistTitle.trim() || 'Imported Excel Checklist',
        isMandatory: true,
        status: 'pending',
        version: 'v1.0',
        versionDate: new Date().toISOString().split('T')[0],
        items: importPreviewItems,
      };

      const updatedGroups = dayData.groups.map((grp) => {
        if (grp.id === excelTargetGroupId) {
          const hasSub = grp.subGroups.some((s) => s.id === excelTargetSubGroupId || s.name.trim().toLowerCase() === targetSubName);
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
        return grp;
      });

      onSaveDayData({ ...dayData, groups: updatedGroups });
      setImportPreviewItems([]);
      setExcelChecklistFile(null);
      showNotification(`Appended ${newChecklist.items.length} checklist items to ${excelChecklistTitle}!`);
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

    if (
      confirm(
        `Are you sure you want to reset password for ${targetName} (${targetUNumber}) back to initial default password (${targetUNumber})?\n\nThe user will be required to change their password on their next login.`
      )
    ) {
      await resetUserPasswordAsync(targetUNumber, currentUser);
      setUsersList(loadUsers());
      showNotification(`Reset password for ${targetUNumber} back to initial default password (${targetUNumber}).`);
    }
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
    if (!window.confirm(`Are you sure you want to delete user ${uNumber}? This will remove them from the system.`)) return;
    
    const success = deleteUserAccount(uNumber, currentUser);
    if (success) {
      await deleteUserFromFirestore(uNumber);
      setUsersList(loadUsers());
      showNotification(`Deleted account ${uNumber}`);
    }
  };

  const handleResetCurrentDayToDefaults = () => {
    if (confirm(`Are you sure you want to reset all operational checklist data for ${dayData.date} back to factory defaults?`)) {
      const fresh = resetDayDataToDefault(dayData.date, currentUser);
      onSaveDayData(fresh);
      showNotification(`Reset operational data for ${dayData.date} to defaults.`);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.uNumber.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        id="admin-panel-modal-container"
        className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[94vh]"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shadow-2xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Ground Operations Control Center
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-850 border border-purple-200 font-bold">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Logged as Administrator: <span className="font-mono text-purple-800 font-bold">{currentUser.uNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-admin-reset-day"
              type="button"
              onClick={handleResetCurrentDayToDefaults}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition shadow-2xs"
              title="Reset Day to Factory Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Day Defaults</span>
            </button>

            <button
              id="btn-close-admin-panel"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 py-2 sm:py-0 bg-slate-50 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="sm:hidden w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold text-xs uppercase tracking-wider transition hover:bg-slate-50"
          >
            <span>Nav: {activeTab === 'groups' ? '1. Operational Groups' : activeTab === 'checklists' ? '2. Checklist Builder' : activeTab === 'excel' ? '3. Excel Importer' : '4. Personnel Roster'}</span>
            <span className="text-lg leading-none">{isMobileNavOpen ? '−' : '+'}</span>
          </button>

          <div className={`${isMobileNavOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 sm:mt-0`}>
            <button
              id="tab-btn-groups"
              type="button"
              onClick={() => { setActiveTab('groups'); setIsMobileNavOpen(false); }}
              className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 sm:border-b-2 transition whitespace-nowrap rounded-lg sm:rounded-none ${
                activeTab === 'groups'
                  ? 'bg-purple-100 sm:bg-transparent sm:border-purple-600 text-purple-700'
                  : 'sm:border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>1. Operational & Flight Groups</span>
            </button>

            <button
              id="tab-btn-checklists"
              type="button"
              onClick={() => { setActiveTab('checklists'); setIsMobileNavOpen(false); }}
              className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 sm:border-b-2 transition whitespace-nowrap rounded-lg sm:rounded-none ${
                activeTab === 'checklists'
                  ? 'bg-purple-100 sm:bg-transparent sm:border-purple-600 text-purple-700'
                  : 'sm:border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              <span>2. Checklist & Item Builder</span>
            </button>

            <button
              id="tab-btn-excel"
              type="button"
              onClick={() => { setActiveTab('excel'); setIsMobileNavOpen(false); }}
              className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 sm:border-b-2 transition whitespace-nowrap rounded-lg sm:rounded-none ${
                activeTab === 'excel'
                  ? 'bg-purple-100 sm:bg-transparent sm:border-purple-600 text-purple-700'
                  : 'sm:border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>3. Excel Bulk Importer</span>
            </button>

            <button
              id="tab-btn-users"
              type="button"
              onClick={() => { setActiveTab('users'); setIsMobileNavOpen(false); }}
              className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-start sm:justify-center gap-2 sm:border-b-2 transition whitespace-nowrap rounded-lg sm:rounded-none ${
                activeTab === 'users'
                  ? 'bg-purple-100 sm:bg-transparent sm:border-purple-600 text-purple-700'
                  : 'sm:border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>4. Personnel Roster</span>
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {feedbackMessage && (
          <div 
            className={`px-6 py-2.5 text-xs flex items-center gap-2 font-semibold shrink-0 animate-in fade-in ${
              feedbackMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
            }`}
          >
            {feedbackMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
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
                  {dayData.groups.map((grp) => (
                    <div
                      key={grp.id}
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
                              key={sub.id}
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
          {activeTab === 'checklists' && (
            <div className="space-y-6">
              {/* Group & Sub-Group Selection Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Group:</label>
                  <select
                    id="select-edit-group"
                    value={selectedEditGroupId}
                    onChange={(e) => {
                      setSelectedEditGroupId(e.target.value);
                      setSelectedEditSubGroupId('');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white font-mono"
                  >
                    <option value="ALL_FLIGHT_GROUPS" className="font-bold text-blue-700">
                      🚀 ALL 4 FLIGHT GROUPS (LX147, LX2647, LH763, LH761)
                    </option>
                    {dayData.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.code}) {g.isFlightGroup ? '✈️' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Destination / Sub-Group:</label>
                  <select
                    id="select-edit-subgroup"
                    value={selectedEditSubGroupId || 'DIRECT_GROUP'}
                    onChange={(e) => setSelectedEditSubGroupId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white font-mono font-semibold"
                  >
                    <option value="DIRECT_GROUP" className="font-bold text-purple-700">
                      📌 DIRECT GROUP CHECKLIST (General Operations)
                    </option>
                    {activeSubGroups.length > 0 && (
                      <optgroup label="Configured Sub-Groups">
                        {activeSubGroups.map((s) => (
                          <option key={s.id} value={s.id}>
                            📂 {s.name} {s.code ? `(${s.code})` : ''} ({s.checklists.length} checklists)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="NEW_SUBGROUP" className="font-bold text-emerald-700">
                      ➕ Create New Sub-Group...
                    </option>
                  </select>

                  {selectedEditSubGroupId === 'NEW_SUBGROUP' && (
                    <div className="mt-2">
                      <label className="block text-[11px] font-bold text-emerald-800 mb-1">New Sub-Group Name:</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramp Safety & Equipment Operations"
                        value={inlineSubGroupName}
                        onChange={(e) => setInlineSubGroupName(e.target.value)}
                        className="w-full p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {isAllFlightGroups && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
                  <Plane className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Macro Synchronized Mode Active:</span> Any checklist or checklist item created, edited, reordered, or deleted under <span className="font-bold underline">{selectedEditSubGroup?.name || 'General Operations'}</span> will instantly synchronize across all 4 flight groups (<span className="font-mono font-bold">LX147, LX2647, LH763, LH761</span>) simultaneously!
                  </div>
                </div>
              )}

              {/* Add New Checklist Form with Versioning */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>
                    {selectedEditSubGroupId === 'DIRECT_GROUP' || !selectedEditSubGroupId
                      ? `Append Checklist Directly to Operational Group ${isAllFlightGroups ? '(All 4 Flight Groups)' : `${selectedEditGroup?.name} (${selectedEditGroup?.code})`}`
                      : `Create New Checklist under ${selectedEditSubGroup?.name || 'Selected Destination'} ${isAllFlightGroups ? '(All 4 Flight Groups)' : `(${selectedEditGroup?.code})`}`}
                  </span>
                </h4>

                <form onSubmit={handleAddChecklist} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Checklist Title:</label>
                      <input
                        type="text"
                        placeholder="Checklist Title (e.g. Ground Power Unit & Air Conditioning Check)"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Version Number:</label>
                      <input
                        type="text"
                        placeholder="e.g. v1.0"
                        value={newChecklistVersion}
                        onChange={(e) => setNewChecklistVersion(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Date Updated:</label>
                      <input
                        type="date"
                        value={newChecklistVersionDate}
                        onChange={(e) => setNewChecklistVersionDate(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Checklist Description (Optional)"
                      value={newChecklistDesc}
                      onChange={(e) => setNewChecklistDesc(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newChecklistIsMandatory}
                        onChange={(e) => setNewChecklistIsMandatory(e.target.checked)}
                        className="rounded border-slate-300 bg-white text-purple-600 focus:ring-purple-500"
                      />
                      <span>Is Mandatory Checklist? (Default: YES)</span>
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAllFlightGroups ? 'Save Checklist to All 4 Flight Groups' : 'Save Checklist'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Display Checklists & Item Editor with Drag-and-Drop and Amend capabilities */}
              {selectedEditSubGroup && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Checklists in {selectedEditSubGroup.name} ({selectedEditSubGroup.checklists.length}){' '}
                      {isAllFlightGroups && <span className="text-blue-600 font-mono text-[11px]">(Sync: LX147, LX2647, LH763, LH761)</span>}
                    </h4>
                  </div>

                  {selectedEditSubGroup.checklists.length === 0 ? (
                    <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-xs font-bold text-slate-700">No Checklists Configured Under {selectedEditSubGroup.name}</div>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Fill in the form above to append a new checklist directly to {isAllFlightGroups ? 'All 4 Flight Groups' : selectedEditGroup?.name || 'this group'}.
                      </p>
                    </div>
                  ) : (
                    selectedEditSubGroup.checklists.map((chk, cIdx) => (
                    <div
                      key={chk.id}
                      draggable
                      onDragStart={() => setDraggedChecklistId(chk.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedChecklistId) {
                          const srcChk = selectedEditSubGroup.checklists.find((c) => c.id === draggedChecklistId);
                          if (srcChk) {
                            handleReorderChecklist(selectedEditSubGroup.id, srcChk.id, srcChk.title, chk.id, chk.title);
                          }
                          setDraggedChecklistId(null);
                        }
                      }}
                      className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3.5 shadow-2xs transition hover:border-purple-200"
                    >
                      {/* Checklist Card Header with Version Info */}
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="cursor-grab text-slate-400 hover:text-slate-600 p-0.5">
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={cIdx === 0}
                              onClick={() => handleMoveChecklist(selectedEditSubGroup.id, chk.id, chk.title, 'up')}
                              className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                              title="Move Checklist Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={cIdx === selectedEditSubGroup.checklists.length - 1}
                              onClick={() => handleMoveChecklist(selectedEditSubGroup.id, chk.id, chk.title, 'down')}
                              className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                              title="Move Checklist Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{chk.title}</span>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {chk.version || 'v1.0'}
                              </span>
                              {chk.versionDate && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Updated: {chk.versionDate}
                                </span>
                              )}
                            </div>
                            {chk.description && <p className="text-xs text-slate-500 mt-0.5">{chk.description}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{chk.items.length} items</span>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingChecklist({
                                id: chk.id,
                                subGroupId: selectedEditSubGroup.id,
                                parentGroupId: selectedEditGroupId,
                                title: chk.title,
                                description: chk.description,
                                isMandatory: chk.isMandatory ?? true,
                                version: chk.version || 'v1.0',
                                versionDate: chk.versionDate || new Date().toISOString().split('T')[0],
                              })
                            }
                            className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition flex items-center gap-1 text-xs font-semibold"
                            title="Amend / Edit Checklist Properties & Version"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Amend</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteChecklist(chk.title, chk.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title={`Delete Checklist ${chk.title} ${isAllFlightGroups ? 'from All 4 Flight Groups' : ''}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Items List with Drag-and-Drop and Amend capabilities */}
                      <div className="space-y-2">
                        {chk.items.map((item, iIdx) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedItemId(item.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedItemId) {
                                handleReorderItem(chk.title, chk.id, draggedItemId, item.id);
                                setDraggedItemId(null);
                              }
                            }}
                            className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs transition hover:border-purple-300"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="cursor-grab text-slate-400 hover:text-slate-600 p-0.5">
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={iIdx === 0}
                                  onClick={() => handleMoveItem(chk.title, chk.id, item.id, 'up')}
                                  className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                                  title="Move Item Up"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={iIdx === chk.items.length - 1}
                                  onClick={() => handleMoveItem(chk.title, chk.id, item.id, 'down')}
                                  className="p-0.5 text-slate-400 hover:text-purple-700 disabled:opacity-20"
                                  title="Move Item Down"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                                #{item.sequenceOrder}
                              </span>
                              <span className="text-slate-800 font-medium truncate">{item.text}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingItem({
                                    id: item.id,
                                    chkId: chk.id,
                                    chkTitle: chk.title,
                                    text: item.text,
                                    isMandatory: item.isMandatory ?? true,
                                  })
                                }
                                className="p-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                                title="Amend Item Text"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleItemMandatory(chk.title, chk.id, item.text, item.id)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                                  item.isMandatory
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-200/70 text-slate-600 border-slate-300'
                                }`}
                                title="Click to toggle mandatory flag"
                              >
                                {item.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(chk.title, chk.id, item.text, item.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quick Add Item Form for this checklist */}
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          placeholder={`Add new checklist item to "${chk.title}"...`}
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItemToChecklist(chk.title, chk.id);
                            }
                          }}
                          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddItemToChecklist(chk.title, chk.id)}
                          className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAllFlightGroups ? '+ Add to All 4 Flights (Mandatory)' : '+ Add Item (Default: Mandatory)'}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
                </div>
              )}
            </div>
          )}

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
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Bulk Import Checklist Items (.xlsx)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Col 1 = Serial No, Col 2 = Item Description, Col 3 = Mandatory (Y/N). Defaults all items to <strong className="text-emerald-700 font-bold">is_mandatory = true</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Group:</label>
                    <select
                      value={excelTargetGroupId}
                      onChange={(e) => {
                        setExcelTargetGroupId(e.target.value);
                        setExcelTargetSubGroupId('');
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white"
                    >
                      <option value="ALL_FLIGHT_GROUPS" className="font-bold text-blue-700">
                        🚀 ALL 4 FLIGHT GROUPS (LX147, LX2647, LH763, LH761)
                      </option>
                      {dayData.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.code}) {g.isFlightGroup ? '✈️' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Sub-Group / Destination:</label>
                    <select
                      value={excelTargetSubGroupId || 'DIRECT_GROUP'}
                      onChange={(e) => setExcelTargetSubGroupId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:bg-white font-semibold"
                    >
                      <option value="DIRECT_GROUP" className="font-bold text-purple-700">
                        📌 Direct Operational Group (General Operations)
                      </option>
                      {excelTargetGroupId === 'ALL_FLIGHT_GROUPS'
                        ? activeSubGroups.map((s) => (
                            <option key={s.id} value={s.name}>
                              📂 {s.name}
                            </option>
                          ))
                        : dayData.groups
                            .find((g) => g.id === excelTargetGroupId)
                            ?.subGroups.map((s) => (
                              <option key={s.id} value={s.id}>
                                📂 {s.name}
                              </option>
                            ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Checklist Title:</label>
                    <input
                      type="text"
                      placeholder="e.g. Standard Turnaround Inspection"
                      value={excelChecklistTitle}
                      onChange={(e) => setExcelChecklistTitle(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white"
                    />
                  </div>
                </div>

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
                    <span className="text-xs font-mono text-sky-700 font-bold">
                      {excelChecklistFile.name} ({importPreviewItems.length} parsed items)
                    </span>
                  )}
                </div>

                {importPreviewItems.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-slate-700">
                      Previewing {importPreviewItems.length} Parsed Items:
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
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {excelTargetGroupId === 'ALL_FLIGHT_GROUPS'
                          ? 'Append Checklist to ALL 4 Flight Groups'
                          : 'Append Checklist to Group'}
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
    </div>
  );
}
