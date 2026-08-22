import { UserAccount, OperationalGroup, SubOperationalGroup, Checklist, ChecklistItem, DayOperationalData } from '@/types/aviation';

export const DEFAULT_USERS: UserAccount[] = [
  {
    uNumber: 'admin',
    name: 'Chief Ops Administrator',
    role: 'ADMIN',
    passwordHash: 'Admin220!',
    mustChangePassword: false,
    department: 'Ground Operations Management',
    createdDate: '2026-01-01T00:00:00.000Z',
  },
  {
    uNumber: 'supervisor',
    name: 'Duty Supervisor',
    role: 'SUPERVISOR',
    passwordHash: 'Supervisor220!',
    mustChangePassword: false,
    department: 'Airside Ramp Supervision',
    createdDate: '2026-01-01T00:00:00.000Z',
  },
];

export const FLIGHT_CODES = ['LX147', 'LX2647', 'LH763', 'LH761'] as const;

// Helper to create checklist items with isMandatory=true by default
export function makeItem(id: string, seq: number, text: string, isMandatory: boolean = true): ChecklistItem {
  return {
    id,
    sequenceOrder: seq,
    text,
    isMandatory,
    status: 'not_done',
  };
}

// Master Flight Sub-groups - Returns empty array (sample sub-groups removed)
export function getMasterFlightSubGroups(_prefix: string): SubOperationalGroup[] {
  return [];
}

// Non-flight operational groups - Clean default groups with no pre-populated sample sub-groups
export function getNonFlightGroups(): OperationalGroup[] {
  return [
    {
      id: 'grp-arrivals',
      name: 'Arrivals Terminal Operations',
      code: 'ARR-OPS',
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups: [],
    },
    {
      id: 'grp-departures',
      name: 'Departures & Gate Management',
      code: 'DEP-OPS',
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups: [],
    },
    {
      id: 'grp-sbd',
      name: 'SBD Operations (Self Bag Drop)',
      code: 'SBD-OPS',
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups: [],
    },
    {
      id: 'grp-security',
      name: 'Security & Airside Access',
      code: 'SEC-OPS',
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups: [],
    },
    {
      id: 'grp-day-shift',
      name: 'Day Shift Operations',
      code: 'DAY-OPS',
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups: [],
    },
  ];
}

const SAMPLE_SUBGROUP_NAMES = new Set([
  'pre-arrival & ramp safety',
  'turnaround, cargo & baggage handling',
  'cabin servicing, catering & fueling',
  'pre-departure, loadsheet & pushback clearance',
  'baggage reclaim hall & belts',
  'customs & transfer corridors',
  'boarding gate infrastructure',
  'kiosk & scale health check',
  'perimeter & ramp badge control',
]);

// Helper to strip any legacy sample sub-groups from day data
export function cleanSampleSubGroups(groups: OperationalGroup[]): OperationalGroup[] {
  if (!groups || !Array.isArray(groups)) return [];
  return groups.map((g) => ({
    ...g,
    subGroups: (g.subGroups || []).filter((sub) => {
      const nameLower = sub.name.trim().toLowerCase();
      if (SAMPLE_SUBGROUP_NAMES.has(nameLower)) return false;
      if (
        sub.id.includes('-sub-pre-arrival') ||
        sub.id.includes('-sub-turnaround-cargo') ||
        sub.id.includes('-sub-cabin-catering') ||
        sub.id.includes('-sub-pre-departure') ||
        sub.id === 'arr-sub-baggage-hall' ||
        sub.id === 'arr-sub-customs-transit' ||
        sub.id === 'dep-sub-gate-ops' ||
        sub.id === 'sbd-sub-kiosk-maintenance' ||
        sub.id === 'sec-sub-perimeter'
      ) {
        return false;
      }
      return true;
    }),
  }));
}

// Generate complete default groups for a target date
export function generateDefaultGroups(): OperationalGroup[] {
  const flightGroups: OperationalGroup[] = FLIGHT_CODES.map((code) => {
    return {
      id: `grp-${code.toLowerCase()}`,
      name: `Flight ${code}`,
      code: code,
      isFlightGroup: true,
      isMandatory: true,
      isVerified: false,
      subGroups: getMasterFlightSubGroups(`flt-${code.toLowerCase()}`),
    };
  });

  const nonFlightGroups = getNonFlightGroups();

  return [...flightGroups, ...nonFlightGroups];
}

export function createInitialDayData(dateStr: string): DayOperationalData {
  return {
    date: dateStr,
    groups: generateDefaultGroups(),
    isShiftClosed: false,
    lastUpdated: `${dateStr}T00:00:00.000Z`,
  };
}
