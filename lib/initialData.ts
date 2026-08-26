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
  {
    uNumber: 'U194283',
    name: 'RAKESH PARMAR',
    role: 'USER',
    passwordHash: 'U194283',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U194317',
    name: 'JASPREET MALIK',
    role: 'USER',
    passwordHash: 'U194317',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U137790',
    name: 'DANISH MANZOOR',
    role: 'USER',
    passwordHash: 'U137790',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U148038',
    name: 'PRIYANKA JAIN',
    role: 'USER',
    passwordHash: 'U148038',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U152260',
    name: 'MANISH PARMAR',
    role: 'USER',
    passwordHash: 'U152260',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U128206',
    name: 'ADITI BHALLA',
    role: 'USER',
    passwordHash: 'U128206',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U177834',
    name: 'CHRISTY',
    role: 'USER',
    passwordHash: 'U177834',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U151236',
    name: 'ARUN SINGH',
    role: 'USER',
    passwordHash: 'U151236',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U193966',
    name: 'ANKITA DUTTA',
    role: 'USER',
    passwordHash: 'U193966',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U148685',
    name: 'ANKIT MISHRA',
    role: 'USER',
    passwordHash: 'U148685',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U177840',
    name: 'BHAGWATI BISWAKARMA',
    role: 'USER',
    passwordHash: 'U177840',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U141960',
    name: 'HARPREET SINGH',
    role: 'USER',
    passwordHash: 'U141960',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U152261',
    name: 'RONAK SINGH',
    role: 'USER',
    passwordHash: 'U152261',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U148030',
    name: 'SIMARPREET KAUR',
    role: 'USER',
    passwordHash: 'U148030',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U125316',
    name: 'ABHAY TIWARI',
    role: 'USER',
    passwordHash: 'U125316',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U184279',
    name: 'YASIR BHAT',
    role: 'USER',
    passwordHash: 'U184279',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U152267',
    name: 'VAIBHAV',
    role: 'USER',
    passwordHash: 'U152267',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U161306',
    name: 'PRAVEEN BALIYAN',
    role: 'USER',
    passwordHash: 'U161306',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U148697',
    name: 'ISHA MANSURI',
    role: 'USER',
    passwordHash: 'U148697',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U150984',
    name: 'IPSHITA KAUR',
    role: 'USER',
    passwordHash: 'U150984',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U145815',
    name: 'PRACHI',
    role: 'USER',
    passwordHash: 'U145815',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U193961',
    name: 'SIDHI SHARMA',
    role: 'USER',
    passwordHash: 'U193961',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U191790',
    name: 'PAYAL',
    role: 'USER',
    passwordHash: 'U191790',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U115470',
    name: 'KHUSHI',
    role: 'USER',
    passwordHash: 'U115470',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U169709',
    name: 'MALVIKA VYAS',
    role: 'USER',
    passwordHash: 'U169709',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U193967',
    name: 'SHIVANGI',
    role: 'USER',
    passwordHash: 'U193967',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U145816',
    name: 'AASIF ALI',
    role: 'USER',
    passwordHash: 'U145816',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U142564',
    name: 'KASHISH BACHHAS',
    role: 'USER',
    passwordHash: 'U142564',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U115377',
    name: 'VINAY RAWAT',
    role: 'USER',
    passwordHash: 'U115377',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U146671',
    name: 'KAJAL',
    role: 'USER',
    passwordHash: 'U146671',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U145823',
    name: 'MANJEET KAUR',
    role: 'USER',
    passwordHash: 'U145823',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U142565',
    name: 'SIMARJEET KAUR',
    role: 'USER',
    passwordHash: 'U142565',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U143324',
    name: 'KRITIKA SHARMA',
    role: 'USER',
    passwordHash: 'U143324',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U146675',
    name: 'KANIKA MEHTA',
    role: 'USER',
    passwordHash: 'U146675',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U119170',
    name: 'MAYANK AGGARWAL',
    role: 'USER',
    passwordHash: 'U119170',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U124807',
    name: 'AMIT KUMAR',
    role: 'USER',
    passwordHash: 'U124807',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U154745',
    name: 'SHIVAM KUMAR',
    role: 'USER',
    passwordHash: 'U154745',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U103735',
    name: 'SUJATA BHARTI',
    role: 'USER',
    passwordHash: 'U103735',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U146554',
    name: 'MAYANK BANGARI',
    role: 'USER',
    passwordHash: 'U146554',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U146557',
    name: 'SHUBHAM PRASAD',
    role: 'USER',
    passwordHash: 'U146557',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U149989',
    name: 'VARUN SHARMA',
    role: 'USER',
    passwordHash: 'U149989',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U193964',
    name: 'PREETI',
    role: 'USER',
    passwordHash: 'U193964',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U102164',
    name: 'DAVINDER SINGH',
    role: 'USER',
    passwordHash: 'U102164',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U102841',
    name: 'PAWANPREET',
    role: 'USER',
    passwordHash: 'U102841',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U152823',
    name: 'AYUSH MEHRA',
    role: 'USER',
    passwordHash: 'U152823',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U149994',
    name: 'SHUBHAM KESTWAL',
    role: 'USER',
    passwordHash: 'U149994',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  },
  {
    uNumber: 'U155961',
    name: 'SUDIP KUMAR',
    role: 'USER',
    passwordHash: 'U155961',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  }

,
  {
    uNumber: 'U123456',
    name: 'U123456',
    role: 'USER',
    passwordHash: 'U123456',
    mustChangePassword: false,
    department: 'Ground Operations',
    createdDate: new Date().toISOString(),
    isAuthorized: true,
  }
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

export const MASTER_FLIGHT_CHECKLISTS: { idSuffix: string; title: string; category?: string; items: { id: string; seq: number; text: string; mand: boolean }[] }[] = [
  {
    idSuffix: 'gate',
    title: 'Gate Checklist',
    items: [
      { id: 'gate-0', seq: 2, text: 'Match cockpit crew name with GENDEC during boarding (LX Flight)', mand: true },
      { id: 'gate-1', seq: 3, text: 'Check gate stationery (Ingenico/GD/Lead Phone/iPad/Mandatory Forms / DG Board etc.)', mand: true },
      { id: 'gate-2', seq: 4, text: 'CISF to be at gate before crew', mand: true },
      { id: 'gate-3', seq: 5, text: 'Display Upgrade Signage (if available)', mand: true },
      { id: 'gate-4', seq: 6, text: 'FIDS Gate Open Display as soon as first staff reaches', mand: true },
      { id: 'gate-5', seq: 7, text: 'Gate Setup: Boarding Group Signage, DGR, Passenger Rights, COB Flyer, Standees, Hand Baggage Sizer', mand: true },
      { id: 'gate-6', seq: 8, text: 'Printer Check', mand: true },
      { id: 'gate-7', seq: 9, text: 'Announcement: Boarding Procedure / Level 4 / Travel Docs / Delay if any', mand: true },
      { id: 'gate-8', seq: 10, text: 'Ineligible List to be Cleared (Travel Doc / Level 4 / Payment if any)', mand: true },
      { id: 'gate-9', seq: 11, text: 'High Priority Comments', mand: true },
      { id: 'gate-10', seq: 12, text: 'Web/Mob/ACI PAX to be Checked and Cancelled if Not Reported', mand: true },
      { id: 'gate-11', seq: 13, text: 'Airport Upsell Announcements 15 Minutes Before Flight Commit', mand: true },
      { id: 'gate-12', seq: 14, text: 'Kiosk Bagg Activation', mand: true },
      { id: 'gate-13', seq: 15, text: 'Flight Commit (LX/LH D-60) & Inform Departure to Print Clearance Paper Immediately', mand: true },
      { id: 'gate-14', seq: 16, text: 'Verify if Manifest Submitted and GD Signed', mand: true },
      { id: 'gate-15', seq: 17, text: 'NRP - Needs Printing', mand: true },
      { id: 'gate-16', seq: 18, text: 'Bagg Count & Always Inform LHG DM (Short or Excess Bags)', mand: true },
      { id: 'gate-17', seq: 19, text: 'Send ETD at D-05 From Planned ETD for Delays Greater Than 10 Minutes', mand: true },
      { id: 'gate-18', seq: 20, text: 'In Case of Gate Change, Allocate 1 Staff at Old Gate and Make Announcement', mand: true },
      { id: 'gate-19', seq: 21, text: 'Reconfirm Final PAX Count With RF (Especially for LX)', mand: true },
      { id: 'gate-20', seq: 22, text: 'Check Baggage Waiver Reason (Should Not Be \'Others\')', mand: true },
      { id: 'gate-21', seq: 23, text: 'Check RED Bags on BRS After Closing', mand: true },
      { id: 'gate-22', seq: 24, text: 'If Aircraft Not Ready for Crew, Coordinate With Purser and Inform Lead / SPV / ADM / LHDM', mand: true },
      { id: 'gate-23', seq: 24, text: 'REMARKS / IRREGULARITIES OBSERVED', mand: true },
      { id: 'gate-24', seq: 25, text: 'No major delays or irregularities observed. All pre-boarding stationery verified, CISF present at 12:30. Cockpit crew GENDEC verified. Flight commit requested at D-60 as per LHG procedure.', mand: true },
    ],
  },
  {
    idSuffix: 'ramp-floater',
    title: 'Ramp Floater Checklist',
    items: [
      { id: 'rf-0', seq: 2, text: 'Ensure you are released from check-in counters on time (A-20) to be positioned at the designated gate or ramp.', mand: true },
      { id: 'rf-1', seq: 3, text: 'Verify cleaning, security, and catering staff are present on-site; immediately contact the Ramp SPOC if anyone is missing.', mand: true },
      { id: 'rf-2', seq: 4, text: 'For SWISS flights, verify only the designated trained cleaning supervisor is on-duty and report deviations.', mand: true },
      { id: 'rf-3', seq: 5, text: 'Contact the wheelchair (UH) team to confirm they are at the gate on time with the required wheelchairs.', mand: true },
      { id: 'rf-4', seq: 6, text: 'Ensure aircraft doors and gate doors open on time; remember only arrival crew may open aircraft doors.', mand: true },
      { id: 'rf-5', seq: 7, text: 'T Meet the Purser at door opening, take handover of DEPU/DEPA or INAD, and hand over to the assigned colleague.', mand: true },
      { id: 'rf-6', seq: 8, text: 'Inform the arrival crew to keep CLP/CBD ready and tell them to proceed to arrivals for Immigration', mand: true },
      { id: 'rf-7', seq: 9, text: 'For LX flights, ensure staff access is via 1L only; ramp jackets are mandatory if entering from 2L.', mand: true },
      { id: 'rf-8', seq: 10, text: 'Introduce yourself to the MC/Purser & act as the sole designated point of contact with the aircraft crew for boarding clearance.', mand: true },
      { id: 'rf-9', seq: 11, text: 'Monitor and ensure the timely retraction of Ground Power Units and Air Conditioning Units after use. (D-20)', mand: true },
      { id: 'rf-10', seq: 12, text: 'Coordinate with the Gate Controller (GC) for baby stroller (STRL) counts and timely ramp dispatch of gate bags.', mand: true },
      { id: 'rf-11', seq: 13, text: 'Strictly follow the turnaround grid and immediately post delays in the group to inform the DM, ADM, and Leads.', mand: true },
      { id: 'rf-12', seq: 14, text: 'Follow the strict door closure sequence: U1L must always be closed first, followed by M2L.', mand: true },
      { id: 'rf-13', seq: 15, text: 'Coordinate with the gate Lead to ensure U1 and M2 doors close timely, latest 17 minutes after boarding start.', mand: true },
      { id: 'rf-14', seq: 16, text: 'Keep DIAL Information Lost and Found contact details handy to assist passengers with Level 4 baggage issues.', mand: true },
      { id: 'rf-15', seq: 17, text: 'Secure any left-behind crew items (iPads, phones) in the office, notify LHG DM, and update the group.', mand: true },
      { id: 'rf-16', seq: 18, text: 'Fully complete the ARC sheet, ensuring both SW and Captain signatures and others are physically signed on the document.', mand: true },
      { id: 'rf-17', seq: 19, text: 'Get the Security File checked and verified by the dedicated Ramp staff assigned to the flight before filing.', mand: true },
      { id: 'rf-18', seq: 20, text: 'Complete the RF details sheet in phone in the correct time format and share on WhatsApp by D+20.', mand: true },
      { id: 'rf-19', seq: 21, text: 'For SWISS flights, ensure the trained cleaning supervisor\'s name is entered in the SI remarks section of the RF sheet.', mand: true },
      { id: 'rf-20', seq: 22, text: 'Securely file all completed flight documentation and security lists in the office cabinets.', mand: true },
      { id: 'rf-21', seq: 23, text: 'Prepare the final RFP Report and hand it over directly to the Duty Manager (DM) to wrap up.', mand: true },
    ],
  },
  {
    idSuffix: 'lead-agent',
    title: 'Lead Agent Checklist',
    items: [
      { id: 'lead-0', seq: 1, text: 'Ensure counters are opened on time after briefing.', mand: true },
      { id: 'lead-1', seq: 2, text: 'Ensure all allocated staff have reported on time and are positioned as per DUTY FLOW.', mand: true },
      { id: 'lead-2', seq: 3, text: 'Verify DG Display, Upgrade Display, FIDS and all at every counter.', mand: true },
      { id: 'lead-3', seq: 4, text: 'Coordinate with AOCC to ensure FIDS is updated. For delayed flights, immediately inform AOCC to update the flight status in the system.', mand: true },
      { id: 'lead-4', seq: 5, text: 'Ensure UH manpower is available and positioned in front of the check-in counters.', mand: true },
      { id: 'lead-5', seq: 6, text: 'Ensure queue-combing staff are positioned at queue lines, exit rows, F-Class/C-Class counters.', mand: true },
      { id: 'lead-6', seq: 6, text: 'Promote use of iPads and PSA/ACA applications for sales. Ensure staff use ACA App for kiosk/SBD support.', mand: true },
      { id: 'lead-7', seq: 7, text: 'Rev X staff available with iPads. Help achieve station revenue targets. Drive ancillary sales: Upgrades, Preferred seats, Sleeper\'s Row, SSAS / SSAB, Excess baggage', mand: true },
      { id: 'lead-8', seq: 8, text: 'Lobby staff available to divert passengers to SBD/Self Kiosk Check-In.', mand: true },
      { id: 'lead-9', seq: 9, text: 'Review flight details and special passenger requirements. Check for AVIH, PETC, special handling cases, wheelchair requests, UMNR, etc. Ensure concerned departments are informed and required staff are briefed.', mand: true },
      { id: 'lead-10', seq: 10, text: 'Flight scanning should be done properly including all the aspects like ETIX, Seat Issues and Monitor delays, oversales, version changes, and operational disruptions.', mand: true },
      { id: 'lead-11', seq: 11, text: 'Maintain a "bird\'s eye view" of the entire operation rather than performing frontline tasks yourself. Maintain overall operational oversight instead of focusing on individual tasks. Track scanner and device movement through Inventory App. Maintain inventory accountability. Ensure all touchpoints (Check-in, SBD, Gates, Transfers, Arrivals) are being monitored', mand: true },
      { id: 'lead-12', seq: 12, text: 'Monitor handling of: HON/FCL passengers, WCHR passengers, Pregnant passengers, Cast passengers, MAAS passengers. Ensure special passenger requirements are identified early.', mand: true },
      { id: 'lead-13', seq: 13, text: 'Ensure strict SOP compliance with no unauthorized deviations. Monitor completion of operational checklists.', mand: true },
      { id: 'lead-14', seq: 14, text: 'Ensure the Gate Controller is released at A-40 with one designated staff member. The Ramp Floater must be released by A-20. Ensure check-in counters are closed at D-90, and the flight is closed in the system within the required timeline.', mand: true },
      { id: 'lead-15', seq: 15, text: 'For LX flights (e.g., LX147 / LX2647), ensure flight-specific closing announcements are made 20-30 minutes before counter closure. Display appropriate signage to inform passengers.', mand: true },
    ],
  },
  {
    idSuffix: 'crew-clearance',
    title: 'Departure Crew Clearance checklist',
    items: [
      { id: 'crew-0', seq: 1, text: 'GD for Crew – 7 copies/ +01 which needs to provided at Gate 08 before 22:00Hrs', mand: true },
      { id: 'crew-1', seq: 1, text: 'Collect arrival CLP AND CBD copy from LHG OFFICE', mand: true },
      { id: 'crew-2', seq: 1, text: 'Get Blank Telex papers beforehand', mand: true },
      { id: 'crew-3', seq: 1, text: 'Collect RR List from Early Counter Agent and secure it with yourself.', mand: true },
      { id: 'crew-4', seq: 2, text: 'CREW CLEARANCE', mand: true },
      { id: 'crew-5', seq: 2, text: 'Coordinate with hyatt or Pernam in case of crew coach or cab delays.', mand: true },
      { id: 'crew-6', seq: 2, text: 'Ensure that when crew arrives, meet with purser/MC and take the CLP and CBD and also check it is filled and stamped', mand: true },
      { id: 'crew-7', seq: 2, text: 'Make sure when crew reached T3, they cleared the immigration and security with in 20 minutes.', mand: true },
      { id: 'crew-8', seq: 2, text: 'When crew crossed the security, immidiately inform Gate controller (GC).', mand: true },
      { id: 'crew-9', seq: 3, text: 'D-90 — SYSTEM & DOCUMENT PREPARATION', mand: true },
      { id: 'crew-10', seq: 3, text: 'Print standby list, acceptance list with passport along with GD\'s and DT slips', mand: true },
      { id: 'crew-11', seq: 4, text: 'D-80 - SYSTEM & DOCUMENT PREPARATION REACH THE IMMIGRATION COUNTERS FOR FLIGHT CLEARANCE', mand: true },
      { id: 'crew-12', seq: 4, text: 'Calculate the total acceptance, including passenger count, crew count and DT, where applicable.', mand: true },
      { id: 'crew-13', seq: 4, text: 'Deduct the applicable DT from the total acceptance', mand: true },
      { id: 'crew-14', seq: 4, text: 'Inform your final count to the immigration officer, If count is not match with immigration then start tally', mand: true },
      { id: 'crew-15', seq: 5, text: 'D-60 - FLIGHT COMMIT', mand: true },
      { id: 'crew-16', seq: 5, text: 'Check with the Gate Controller or verify in the system regarding the flight commit.', mand: true },
      { id: 'crew-17', seq: 5, text: 'Print all the documents for i.e. Acceptance List with Passport No., no show list, web checkin list. And also print acceptance list without passport for customs', mand: true },
      { id: 'crew-18', seq: 5, text: 'Present the required documents to Immigration.', mand: true },
      { id: 'crew-19', seq: 5, text: 'Cross-check final count', mand: true },
      { id: 'crew-20', seq: 5, text: 'Obtain Immigration clearance/stamp/signature', mand: true },
      { id: 'crew-21', seq: 6, text: 'D-40 MINUTES — CUSTOMS CLEARANCE', mand: true },
      { id: 'crew-22', seq: 6, text: 'Proceed to Customs after Immigration clearance', mand: true },
      { id: 'crew-23', seq: 6, text: 'Submit RR papers, No-Show List, Acceptance List & Cargo Manifest', mand: true },
      { id: 'crew-24', seq: 6, text: 'Obtain Customs clearance', mand: true },
      { id: 'crew-25', seq: 6, text: 'Verify required stamps/signatures', mand: true },
      { id: 'crew-26', seq: 6, text: 'Inform Gate Controller about clearance', mand: true },
      { id: 'crew-27', seq: 6, text: 'Check and record EGM number', mand: true },
      { id: 'crew-28', seq: 6, text: 'Deposit stamped GD and Customs documents', mand: true },
    ],
  },
  {
    idSuffix: 'immig-clearance',
    title: 'Departure Immig Clearance checklist',
    items: [
      { id: 'immig-0', seq: 1, text: 'Collect the RR list from the early counters agents and Crew GD\'S from Pre-Flight agents.', mand: true },
      { id: 'immig-1', seq: 2, text: 'D-90 : Get the system and make it ready for Printing the documents for flight clearance(chklist to be followed for same).', mand: true },
      { id: 'immig-2', seq: 3, text: 'D-60 : check with Gate Controller or in system about the flight commit(you can chk the noshow list in the system if has the red cross all together it means the flight is closed and also if we have any SBY Passengers in overbooking situations then you can also chk if SBY passengers are accepted in system). If Count not tallied inform the Lead or Gate controller and start the tally.', mand: true },
      { id: 'immig-3', seq: 4, text: 'D-50 : Reach the Immigrations counters for the clearance and check for the count match calculating the total acceptance, crew and DT(you need to minus the DT from the total count of acceptance and crew).', mand: true },
      { id: 'immig-4', seq: 5, text: 'D-40 : After taking Clearance from immigration take the stamp and reach the customs and take the clearance of RR and no show from them and get the stamp and signatures from customs accordingly.', mand: true },
      { id: 'immig-5', seq: 6, text: 'D-30 : Inform the gate about the clearance and take the EGM number from system(deposit the stamped GD along with all the papers you took to customs for clearance).', mand: true },
    ],
  },
];

export const MASTER_NON_FLIGHT_DEFINITIONS = [
  {
    groupId: 'grp-arrivals',
    groupName: 'Arrivals Terminal Operations',
    groupCode: 'ARR-OPS',
    subGroupName: 'General Operations',
    checklists: [
      {
        idSuffix: 'arr-dt',
        title: 'Arrival DT Clearance Checklist',
        items: [
          { id: 'arr-dt-1', seq: 2, text: 'CHECK IF THE BAGS ARE TAGGED TO THE FINAL DESTINATON AND IN WHICH CONTAINER NUMBERS AND INFORM THE BREAK UP STAFF TO FORWARD THE SAME AT TRANSFER BELT .', mand: true },
          { id: 'arr-dt-2', seq: 3, text: 'INFORMATION OF DT SLIP TO BE GIVEN IN ADVANCE AND COORDINATE WITH OAL FOR SMOOTH TRANSFER .', mand: true },
          { id: 'arr-dt-3', seq: 4, text: 'DT SLIP TO BE HANDOVER TO STAFF TAKING FLIGHT CLEARANCE .', mand: true },
          { id: 'arr-dt-4', seq: 5, text: 'IF FLIGHTS ARE DELAYED THEN DT PASSENGERS ARE TO BE REBOOKED IN ADVANCED THROUGH RBC .', mand: true },
        ],
      },
      {
        idSuffix: 'arr-ll',
        title: 'Arrival and LL checklist overall',
        items: [
          { id: 'arr-ll-1', seq: 2, text: 'If delayed, check for misconnection/critical connection. Coordinate with LHG and rebook where required as per MCT/arrival situation.', mand: true },
          { id: 'arr-ll-2', seq: 3, text: 'Check DT passengers and baggage location. Also check First Class and HON passenger baggage.', mand: true },
          { id: 'arr-ll-3', seq: 4, text: 'Scan the flight thoroughly for special items: WEAP / AVIH / PETC / SPEQ / MEDA.', mand: true },
          { id: 'arr-ll-4', seq: 5, text: 'Check for deportee / BONA passengers and send telex on the particular flight in a timely manner.', mand: true },
          { id: 'arr-ll-5', seq: 6, text: 'Prepare Rush Bag / Expedite List. Vendors: Outlook – odd days; VVM International – even days.', mand: true },
          { id: 'arr-ll-6', seq: 7, text: 'Check Customs Forms. Ensure forms are filled correctly and obtain LHG DM signature.', mand: true },
          { id: 'arr-ll-7', seq: 8, text: 'Check DH prior and coordinate with Arrival Flight Clearance staff for all papers, GD correct date and required details. Prepare letters prior if required.', mand: true },
          { id: 'arr-ll-8', seq: 9, text: 'Check/confirm forwarding of bags not arriving and prepare passenger name list for prior contact.', mand: true },
          { id: 'arr-ll-9', seq: 10, text: 'Check Log Entries and take necessary action.', mand: true },
          { id: 'arr-ll-10', seq: 11, text: 'Check arrival bag and all papers: Customs Form / Scanners / Deportee Proforma / Red Flyer / Blue Flyer / AOC Card. Also check Ebola Forms or other local-procedure forms.', mand: true },
          { id: 'arr-ll-11', seq: 12, text: 'Check priority, First Class and Economy baggage locations as per LIR shared by ALS and share information with BBA staff, including DT bags.', mand: true },
          { id: 'arr-ll-12', seq: 13, text: 'Check staff presence. Report any shortage/missing staff to DM/ADM.', mand: true },
          { id: 'arr-ll-13', seq: 14, text: 'Ensure iPads and Arrival Lead cell are assigned and kept active at the belt.', mand: true },
          { id: 'arr-ll-14', seq: 15, text: 'Brief all staff properly regarding their assigned tasks.', mand: true },
          { id: 'arr-ll-15', seq: 16, text: 'Check for re-export bags remaining in the arrival hall for more than 24 hours.', mand: true },
          { id: 'arr-ll-16', seq: 17, text: 'Update belt information.', mand: true },
          { id: 'arr-ll-17', seq: 18, text: 'Check staff presence at belt and ensure staff have iPads. Check UH at belt; if missing/short, contact Scale Supervisor immediately.', mand: true },
          { id: 'arr-ll-18', seq: 19, text: 'Ensure iPads are used as first priority at belt and Star Alliance is used for PIR creation.', mand: true },
          { id: 'arr-ll-19', seq: 20, text: 'Check name list is pasted on the tub and rotating on the belt.', mand: true },
          { id: 'arr-ll-20', seq: 21, text: 'Inform belt staff to keep moving along the belt. If any domestic connection bag is found, try contacting the passenger immediately.', mand: true },
          { id: 'arr-ll-21', seq: 22, text: 'Start segregation of Rush Bags and sealing/wrapping process.', mand: true },
          { id: 'arr-ll-22', seq: 23, text: 'After belt bags are over, clear Rush Bags.', mand: true },
          { id: 'arr-ll-23', seq: 24, text: 'Arrival Lead to assign staff accordingly so workload is balanced and tasks are completed efficiently: OOG checks / belt checks / left domestic connection bags.', mand: true },
          { id: 'arr-ll-24', seq: 25, text: 'Bags cleared from Customs must be handed over to the vendor. Any bags left behind or marked preventive must have AOC Card attached. Note: AOC Card only for Customs Denied Bags.', mand: true },
          { id: 'arr-ll-25', seq: 26, text: 'Create OHD for all bags without PIR / left bags.', mand: true },
          { id: 'arr-ll-26', seq: 27, text: 'Tie ribbon on all LHG bags for easy recognition.', mand: true },
          { id: 'arr-ll-27', seq: 28, text: 'Create BDO for bags handed over to delivery and send the Excel sheet to BSC BKK.', mand: true },
          { id: 'arr-ll-28', seq: 29, text: 'Update the sheet for all bags left behind at arrival hall, along with the reason, in Teams.', mand: true },
          { id: 'arr-ll-29', seq: 30, text: 'Create Log Entries for Duty 2.', mand: true },
          { id: 'arr-ll-30', seq: 31, text: 'Check all Domestic Bags are forwarded and all forwardings are sent.', mand: true },
        ],
      },
      {
        idSuffix: 'arr-weap',
        title: 'Arrival Weapons Checklist',
        items: [
          { id: 'arr-weap-1', seq: 2, text: 'PRE INFORM 4 HOUR PRIOR TO ARRIVAL TO AI EXPRESS SECURITY STAFF ON +91 9217703384', mand: true },
          { id: 'arr-weap-2', seq: 3, text: 'SECURITY WILL ESCORT THE WEAPON FROM AIRCRAFT TO THE TILL CUSTOMS', mand: true },
          { id: 'arr-weap-3', seq: 4, text: 'NEED TO HAVE WEAPON RECEIVAL FORM IN ARRIVAL BAG ( IF NOT KINDLY PRINT IT)', mand: true },
          { id: 'arr-weap-4', seq: 5, text: 'DECLARE WEAPON IN CUSTOMS WITH ALL THE DOCUMENS ( LIKE SERIAL NO. & ALL)', mand: true },
        ],
      },
    ],
  },
  {
    groupId: 'grp-departures',
    groupName: 'Departures & Gate Management',
    groupCode: 'DEP-OPS',
    subGroupName: 'General Operations',
    checklists: [
      {
        idSuffix: 'dep-dt',
        title: 'Departure DT Checklist',
        items: [
          { id: 'dep-dt-1', seq: 2, text: 'ALLOCATION OF INTERNATIONAL TRANSFER DESK TO BE ASSIGNED AS PER THE DT PASSNEGER INCOMING FLIGHT NUMBER .', mand: true },
          { id: 'dep-dt-2', seq: 3, text: 'CHECK-IN THE PASSENGER WITH AS PER PROPER DOCUMENTATION IF ANY DOUBT COMES THEN CONTACT ALO AND INFORM LHG DM ACCORDINGLY .', mand: true },
          { id: 'dep-dt-3', seq: 4, text: 'IF THROUGH CHECK-IN DT PASSENGERS ARE COMING THEN TRY TO SEDN THEM AT GATE AND THEN VERIFIED THE DOCUMENTS AND BAGGAGE RECONCILATION .', mand: true },
          { id: 'dep-dt-4', seq: 5, text: 'IF IN CASE OF DELAYED FLIGHT ENSURE THAT DT CONNECTIONS ARE MONITORED AND THEIR BAGS ARE RETAG ACCORDING TO NEW FLIGHT DETAILS .', mand: true },
          { id: 'dep-dt-5', seq: 6, text: 'F/CL AND HON GUEST CONNECTING TO LHG FLIGHTS ARE TAKEN EXTRA CARE AND PA STAFF TO BE ASSIGNED ACCORDINGLY .', mand: true },
          { id: 'dep-dt-6', seq: 7, text: 'HANDOVER THE DT SLIP TO THE DEPARTURE STAFF ACCORDINGLY WELL ON TIME .', mand: true },
        ],
      },
      {
        idSuffix: 'dep-weap',
        title: 'Departure Weapons Checklist',
        items: [
          { id: 'dep-weap-1', seq: 1, text: 'PRE INFORM TO BE GIVEN 3 HOUR PRIOR  AI EXPRESS SECURITY STAFF ON +91 9217703384', mand: true },
          { id: 'dep-weap-2', seq: 2, text: 'CONFIRM WEAPON SERVICE(WEAP)  IN PNR', mand: true },
          { id: 'dep-weap-3', seq: 3, text: 'CHECK ALL WEAPON DOCUMENTS INCLUDING LICENSE', mand: true },
          { id: 'dep-weap-4', seq: 4, text: 'WEAPON FORM FOR SECURITY TO BE READY / FILLED IN ADVANCE', mand: true },
          { id: 'dep-weap-5', seq: 5, text: 'MAKE SURE PUT \'SEC\' LABELS ON  WEAP & AMMO AND  PRINT TAG AS A WEAP.', mand: true },
          { id: 'dep-weap-6', seq: 6, text: 'WEAP TO BE DECLARE IN THE CUSTOMS', mand: true },
          { id: 'dep-weap-7', seq: 7, text: 'AI EXPRESS STAFF WILL ESCORT WEAPON TILL THE AIRCRAFT', mand: true },
        ],
      },
      {
        idSuffix: 'dep-ticket',
        title: 'Ticketing Checklist',
        items: [
          { id: 'dep-tkt-1', seq: 2, text: 'Check the current Rate List before starting ticketing activities.\r\nUpdate the Rate List if required.', mand: true },
          { id: 'dep-tkt-2', seq: 3, text: 'Before charging the passenger, double-check the amount to ensure the correct amount is being charged.', mand: true },
          { id: 'dep-tkt-3', seq: 4, text: 'RBC Contact Number: 0008000501576\r\n\r\nUse the appropriate option based on the requirement:\r\n• Option 1: Excess baggage and all other ancillary services\r\n• Option 2: Out-of-sequence, voluntary ticket change and new ticket sale\r\n• Option 3: Involuntary ticket change\r\n• Option 4: Complex cases, EXST and WCLB restrictions (NAME CHANGE)\r\n• Option 6: Sales report-related inquiries\r\n• Option 7: INAD and remark updates\r\n• Option 8: Seat block', mand: true },
          { id: 'dep-tkt-4', seq: 5, text: 'First try to take the payment through the ACA App.\r\nIf charging through a CC Form, ensure the card number is always masked.\r\nEnsure the CC Form is duly signed by the passenger/cardholder to whom the card belongs.', mand: true },
          { id: 'dep-tkt-5', seq: 6, text: 'Once the EMD// MCO is generated, verify that the amount mentioned is correct.\r\nEnsure the EMD//MCO is created for DELSM.', mand: true },
          { id: 'dep-tkt-6', seq: 7, text: 'Before closing the counter, ensure that no passenger is under the unpaid option.\r\nVerify and clear all pending/unpaid transactions before closure.', mand: true },
          { id: 'dep-tkt-7', seq: 8, text: 'After counter closure, tally the payments with EBIX.\r\nCross-check the same with the Informative, wherever applicable.\r\nIf there is any discrepancy, immediately inform LHG DM.', mand: true },
          { id: 'dep-tkt-8', seq: 9, text: 'After the flight BOARDING STARTED, request RBC for the Closed Sales Report through the DELSM mailbox.\r\nUpdate the REV in Teams after receiving/processing the report.\r\nCASH + CREDIT + INGENICO - TAXES = REV', mand: true },
          { id: 'dep-tkt-9', seq: 10, text: 'Scan all CC Forms.\r\nEnsure the scanned document is converted into a locked PDF.\r\nSend the locked PDF to the DELSM mailbox.', mand: true },
        ],
      },
      {
        idSuffix: 'dep-transfer',
        title: 'International Transfer Checklist',
        items: [
          { id: 'dep-trf-1', seq: 2, text: 'Inform and coordinate with OAL/LHG staff in advance.', mand: true },
          { id: 'dep-trf-2', seq: 3, text: 'Check baggage is tagged to the final destination and note container/ULD numbers.', mand: true },
          { id: 'dep-trf-3', seq: 4, text: 'Inform break-up/transfer belt staff to forward DT baggage correctly.', mand: true },
          { id: 'dep-trf-4', seq: 5, text: 'Monitor passenger arrival and transfer to the onward flight.', mand: true },
          { id: 'dep-trf-5', seq: 6, text: 'Handover the DT Slip to the concerned staff for flight clearance.', mand: true },
          { id: 'dep-trf-6', seq: 7, text: 'Check the Incarriage List in AlteaCM and confirm onward flight details.', mand: true },
          { id: 'dep-trf-7', seq: 8, text: 'Ensure correct International Transfer Desk is allocated.', mand: true },
          { id: 'dep-trf-8', seq: 9, text: 'Check passenger documents and complete onward check-in.', mand: true },
          { id: 'dep-trf-9', seq: 10, text: 'For any document doubt, contact ALO/LHG DM.', mand: true },
          { id: 'dep-trf-10', seq: 11, text: 'Ensure baggage reconciliation and correct routing to the onward flight.', mand: true },
          { id: 'dep-trf-11', seq: 12, text: 'Handover the DT Slip to departure staff on time.', mand: true },
          { id: 'dep-trf-12', seq: 13, text: 'Monitor flight status and DT connections until departure.', mand: true },
          { id: 'dep-trf-13', seq: 14, text: 'If delayed, arrange rebooking through RBC where required.', mand: true },
          { id: 'dep-trf-14', seq: 15, text: 'Ensure baggage is re-tagged/re-routed as per new flight details.', mand: true },
          { id: 'dep-trf-15', seq: 16, text: 'Reconfirm passenger and baggage details after any change.', mand: true },
          { id: 'dep-trf-16', seq: 17, text: 'Identify F/CL and HON guests connecting to LHG flights.', mand: true },
          { id: 'dep-trf-17', seq: 18, text: 'Arrange additional support/PA staff where required.', mand: true },
          { id: 'dep-trf-18', seq: 19, text: 'Confirm passenger and baggage have completed the transfer successfully.', mand: true },
          { id: 'dep-trf-19', seq: 20, text: 'Ensure all DT information/slips are handed over and any pending issue is communicated.', mand: true },
        ],
      },
    ],
  },
  {
    groupId: 'grp-sbd',
    groupName: 'SBD Operations (Self Bag Drop)',
    groupCode: 'SBD-OPS',
    subGroupName: 'General Operations',
    checklists: [
      {
        idSuffix: 'sbd-main',
        title: 'SBD Checklist',
        items: [
          { id: 'sbd-1', seq: 1, text: 'SBD and hybrid counter staff must report on-site by 19:00 hrs to ensure counter readiness.', mand: true },
          { id: 'sbd-2', seq: 2, text: 'Ensure SBD and hybrid counters are fully operational and open to passengers by 19:15–19:20 hrs.', mand: true },
          { id: 'sbd-3', seq: 3, text: 'Deploy a minimum of 8 staff: 3 at counters (P1, P12, Podium), 3 at kiosks, and 2 for doc checks.', mand: true },
          { id: 'sbd-4', seq: 4, text: 'Allocate 2 additional staff from the Queue Management (QM) pool to actively divert passengers to SBD.', mand: true },
          { id: 'sbd-5', seq: 5, text: 'Actively steer operations to process a minimum daily target of 100 passengers on SWISS flights starting June 1st.', mand: true },
          { id: 'sbd-6', seq: 6, text: 'Maintain a daily SBD processing target of 300 passengers for Lufthansa flights to maximize station efficiency.', mand: true },
          { id: 'sbd-7', seq: 7, text: 'Ensure all iPads and connected Ingenico payment units are fully charged before shift briefings to prevent operational downtime.', mand: true },
          { id: 'sbd-8', seq: 8, text: 'Record all iPad and credit card terminal movements in the Inventory App at the start and end of shifts.', mand: true },
          { id: 'sbd-9', seq: 9, text: 'Never pack iPads into bags with sharp-edged steel frames to prevent screen damage and shattering.', mand: true },
          { id: 'sbd-10', seq: 10, text: 'Verify that Dangerous Goods (DG) displays are clearly placed at all CUSS and SBD touchpoints.', mand: true },
          { id: 'sbd-11', seq: 11, text: 'Set up 2 pylons in Row P with A3 insert signages displaying the DG and Upgrade Info', mand: true },
          { id: 'sbd-12', seq: 12, text: 'Ensure the "Gate Closes 20 Minutes Before Departure" stamps and ink pads are available at all kiosk positions.', mand: true },
          { id: 'sbd-13', seq: 13, text: 'Position the Lead Agent at Row P to manage signages, profile customers, and oversee the entire queue flow.', mand: true },
          { id: 'sbd-14', seq: 14, text: 'Place CUSS/kiosk staff at the 6 machines in the terminal lobby to assist and stamp boarding passes.', mand: true },
          { id: 'sbd-15', seq: 15, text: 'Actively direct passengers from underutilized lobby Kiosks 11 and 12 to SBD counters P13 and P14.', mand: true },
          { id: 'sbd-16', seq: 16, text: 'Staff hybrid counters at either end of Row P using ACA to handle excess baggage and kiosk failures.', mand: true },
          { id: 'sbd-17', seq: 17, text: 'Equip lobby staff with iPads and the ACA App to assist passengers and minimize dwell times during kiosk malfunctions.', mand: true },
          { id: 'sbd-18', seq: 18, text: 'Use connected iPads and the PSA app to calculate and process excess baggage charges immediately at Row P.', mand: true },
          { id: 'sbd-19', seq: 19, text: 'Prioritize Munich-bound passengers for SBD as they match the tech-savvy profile and generate critical online feedback.', mand: true },
          { id: 'sbd-20', seq: 20, text: 'Direct Canada-bound Frankfurt passengers with heavy or oversized bags to regular Row L check-in counters instead.', mand: true },
          { id: 'sbd-21', seq: 21, text: 'Do not send elderly, families with kids, or passengers requiring special assistance (WCHR) to SBD units.', mand: true },
          { id: 'sbd-22', seq: 22, text: 'Direct families and special assistance passengers exclusively to the last 2 counters, marked with "Families/Special Assistance" FIDS.', mand: true },
          { id: 'sbd-23', seq: 23, text: 'Ensure SBD, hybrid counter, and kiosk staff are briefed on specific flight-handling targets and daily upsell goals.', mand: true },
          { id: 'sbd-24', seq: 24, text: 'Ensure passengers complete baggage tagging before reaching the SBD belt to avoid creating a bottleneck at the unit.', mand: true },
          { id: 'sbd-25', seq: 25, text: 'Instruct passengers not to lean on SBD belts as it blocks scanning cameras, resulting in bag rejection.', mand: true },
          { id: 'sbd-26', seq: 26, text: 'Always place soft bags or baggage with irregular edges on the provided trays to prevent SBD sensor rejections.', mand: true },
          { id: 'sbd-27', seq: 27, text: 'Ensure staff sitting at hybrid counters generate baggage charge slips immediately to avoid sending passengers to main counters.', mand: true },
          { id: 'sbd-28', seq: 28, text: 'Verify travel documents and put the gate closure stamp on the boarding pass when BP/BT are printed.', mand: true },
          { id: 'sbd-29', seq: 29, text: 'Perform rigorous Carry-On Baggage (COB) checks at the SBD podium as the next passenger touchpoint is the gate.', mand: true },
        ],
      },
    ],
  },
  {
    groupId: 'grp-security',
    groupName: 'Security & Airside Access',
    groupCode: 'SEC-OPS',
    subGroupName: 'General Operations',
    checklists: [
      {
        idSuffix: 'sec-render',
        title: 'Render Sheets and Excel Update',
        items: [
          { id: 'sec-render-1', seq: 1, text: 'Check for all Render sheets and whether signed and updated as per actual manpower provided as per times mentioned', mand: true },
          { id: 'sec-render-2', seq: 2, text: 'File all documents in respective Flights Folders', mand: true },
          { id: 'sec-render-3', seq: 3, text: 'Update Excel Sheet in Teams (interim checklist item)', mand: true },
          { id: 'sec-render-4', seq: 4, text: 'Report Security shortcomings and staff shortages or delays to Sweta, Saksham, Shashi and LHG DM on duty', mand: true },
        ],
      },
    ],
  },
  {
    groupId: 'grp-day-shift',
    groupName: 'Day Shift Operations',
    groupCode: 'DAY-OPS',
    subGroupName: 'General Operations',
    checklists: [
      {
        idSuffix: 'duty2-main',
        title: 'Duty 2 Checklist',
        items: [
          { id: 'duty2-1', seq: 1, text: 'All log entries to be actioned on a daily basis.', mand: true },
          { id: 'duty2-2', seq: 2, text: 'Check with the baggage delivery vendor that BDO’s are created for all the bags.\r\nIf any BDO’s are left out, same to be created ASAP to avoid delayed baggage delivery.', mand: true },
          { id: 'duty2-3', seq: 3, text: 'Forwarding for departure bags is to be sent on a daily basis.', mand: true },
          { id: 'duty2-4', seq: 4, text: 'Check in Altea if any First Class Pax or HON Circle Member is arriving before 1800 hrs.\r\nIf there is any booking, assistance to be provided till Lounge.', mand: true },
          { id: 'duty2-5', seq: 5, text: 'One staff will be allocated on a daily basis to check all LHG bags in the following areas:\r\n• Makeup Area\r\n• Breakup Area\r\n• Arrival Hall\r\n• EBS\r\n• Level 4\r\nIf any bags are located, same to be clear on Priority basis and message to be inserted in LHG group.', mand: true },
          { id: 'duty2-6', seq: 6, text: 'LL follow up to be done on a daily basis.', mand: true },
          { id: 'duty2-7', seq: 7, text: 'If any F/cls PIR has been made, call and mail has to be sent to the passenger and inform him/her about the baggage status.', mand: true },
          { id: 'duty2-8', seq: 8, text: 'DELST mailbox and Lost and found mailbox to be actioned and mails need to be transferred to respective folders.', mand: true },
          { id: 'duty2-9', seq: 9, text: 'All devices to be fully charged on a daily basis (Ingenico, iPad’s, I-Phones, weighing machine).', mand: true },
          { id: 'duty2-10', seq: 10, text: 'Make sure all Phones are on ringer mode and should be picked before the second ring.', mand: true },
          { id: 'duty2-11', seq: 11, text: 'Printing of RR papers to be done at 1700 hrs and to be given to Customs.', mand: true },
          { id: 'duty2-12', seq: 12, text: 'Local stock to be monitored.\r\nIf something is less or out of stock, the same needs to be ordered at the earliest.', mand: true },
          { id: 'duty2-13', seq: 13, text: 'Other admin tasks also to be handled i.e:\r\n• BCAS work\r\n• Verification status\r\n• AVSEC work\r\n• Biometric work\r\n• Making AEP’s for passengers for non recommended bags', mand: true },
          { id: 'duty2-14', seq: 14, text: 'ONE TEAM • ONE GOAL    |    SERVICE WITH CARE. EVERY BAG. EVERY PASSENGER.    |    ON TIME. EVERY TIME.', mand: true },
        ],
      },
    ],
  },
];

// Helper to compute next automated version string
export function getNextChecklistVersion(currentVersion?: string, isMajor: boolean = false): string {
  if (!currentVersion || !currentVersion.trim()) return 'v1.1';
  const clean = currentVersion.trim().replace(/^v/i, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10));
  const major = isNaN(parts[0]) || parts[0] < 1 ? 1 : parts[0];
  const minor = isNaN(parts[1]) || parts[1] < 0 ? 0 : parts[1];

  if (isMajor) {
    return `v${major + 1}.0`;
  }
  return `v${major}.${minor + 1}`;
}

// Helper to build a checklist instance with fresh not_done items
export function instantiateChecklist(
  prefix: string,
  template: { idSuffix?: string; title: string; category?: string; items: { id: string; seq: number; text: string; mand: boolean }[] }
): Checklist {
  const chkId = `chk-${prefix}-${template.idSuffix || template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const items: ChecklistItem[] = template.items.map((it, idx) => ({
    id: `it-${prefix}-${it.id || idx}`,
    sequenceOrder: it.seq,
    text: it.text,
    isMandatory: it.mand !== false,
    status: 'not_done',
  }));

  const initialVersion = 'v1.0';
  const initialDate = '2026-08-20';

  return {
    id: chkId,
    title: template.title,
    isMandatory: true,
    status: 'pending',
    version: initialVersion,
    versionDate: initialDate,
    versionHistory: [
      {
        version: initialVersion,
        versionDate: initialDate,
        updatedBy: 'System Baseline',
        itemCount: items.length,
        changeType: 'INITIAL',
        notes: 'Initial station master checklist baseline configuration',
        timestamp: new Date('2026-08-20T00:00:00.000Z').toISOString(),
      },
    ],
    items,
  };
}

// Master Flight Sub-groups - Populates the 5 master checklists for any flight group
export function getMasterFlightSubGroups(prefix: string): SubOperationalGroup[] {
  const checklists: Checklist[] = MASTER_FLIGHT_CHECKLISTS.map((t) => instantiateChecklist(prefix, t));
  return [
    {
      id: `sub-${prefix}-general`,
      name: 'General Operations',
      isMandatory: true,
      checklists,
    },
  ];
}

// Non-flight operational groups - Populates the exact defined checklists for non-flight groups
export function getNonFlightGroups(): OperationalGroup[] {
  return MASTER_NON_FLIGHT_DEFINITIONS.map((def) => {
    const checklists: Checklist[] = def.checklists.map((t) => instantiateChecklist(def.groupId, t));
    const subGroups: SubOperationalGroup[] = [
      {
        id: `sub-${def.groupId}-general`,
        name: def.subGroupName || 'General Operations',
        isMandatory: true,
        checklists,
      },
    ];

    return {
      id: def.groupId,
      name: def.groupName,
      code: def.groupCode,
      isFlightGroup: false,
      isMandatory: true,
      isVerified: false,
      subGroups,
    };
  });
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

// Helper to merge master template hierarchy with an existing DayOperationalData,
// strictly preserving all user progress, checked item states, remarks, timestamps,
// group verifications, and shift closure states.
// Ensure all groups, subGroups, checklists, and items in DayOperationalData have guaranteed unique IDs
export function sanitizeDayData(data: DayOperationalData): DayOperationalData {
  if (!data || !data.groups || !Array.isArray(data.groups)) return data;

  const seenGroupIds = new Set<string>();

  const sanitizedGroups = data.groups.map((grp, gIdx) => {
    let grpId = grp.id || `grp-${gIdx}`;
    if (seenGroupIds.has(grpId)) {
      grpId = `${grpId}-dup-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenGroupIds.add(grpId);

    const seenSubIds = new Set<string>();
    const sanitizedSubGroups = (grp.subGroups || []).map((sub, sIdx) => {
      let subId = sub.id || `sub-${grpId}-${sIdx}`;
      if (seenSubIds.has(subId)) {
        subId = `${subId}-dup-${Math.random().toString(36).substring(2, 6)}`;
      }
      seenSubIds.add(subId);

      const seenChkIds = new Set<string>();
      const sanitizedChecklists = (sub.checklists || []).map((chk, cIdx) => {
        let chkId = chk.id || `chk-${subId}-${cIdx}`;
        if (seenChkIds.has(chkId)) {
          chkId = `${chkId}-dup-${Math.random().toString(36).substring(2, 6)}`;
        }
        seenChkIds.add(chkId);

        const seenItemIds = new Set<string>();
        const sanitizedItems = (chk.items || []).map((item, iIdx) => {
          let itemId = item.id || `item-${chkId}-${iIdx}`;
          if (seenItemIds.has(itemId)) {
            itemId = `${itemId}-dup-${Math.random().toString(36).substring(2, 6)}`;
          }
          seenItemIds.add(itemId);

          return {
            ...item,
            id: itemId,
          };
        });

        return {
          ...chk,
          id: chkId,
          items: sanitizedItems,
        };
      });

      return {
        ...sub,
        id: subId,
        checklists: sanitizedChecklists,
      };
    });

    return {
      ...grp,
      id: grpId,
      subGroups: sanitizedSubGroups,
    };
  });

  return {
    ...data,
    groups: sanitizedGroups,
  };
}

export function mergeMasterHierarchyWithExisting(
  existing: DayOperationalData,
  dateStr: string
): { merged: DayOperationalData; changed: boolean } {
  let changed = false;
  const masterGroups = generateDefaultGroups();

  if (!existing || !existing.groups || !Array.isArray(existing.groups) || existing.groups.length === 0) {
    return {
      merged: createInitialDayData(dateStr),
      changed: true,
    };
  }

  // Clean out legacy sample subgroups first
  const cleanedExistingGroups = cleanSampleSubGroups(existing.groups);
  if (cleanedExistingGroups.length !== existing.groups.length) {
    changed = true;
  }

  // Preserve existing user-saved groups, subgroups, checklists, and items as authoritative
  const mergedGroups: OperationalGroup[] = cleanedExistingGroups.map((existingGroup) => {
    const masterGroup = masterGroups.find(
      (mg) => mg.id === existingGroup.id || mg.code.toUpperCase() === existingGroup.code.toUpperCase()
    );

    const existingSubGroups = existingGroup.subGroups || [];
    const mergedSubGroups: SubOperationalGroup[] = existingSubGroups.map((existingSubGroup) => {
      const masterSubGroup = masterGroup?.subGroups.find(
        (msg) => msg.id === existingSubGroup.id || msg.name.trim().toLowerCase() === existingSubGroup.name.trim().toLowerCase()
      );

      const existingChecklists = existingSubGroup.checklists || [];

      // If a subgroup has existing checklists, sanitize items and compute status
      let mergedChecklists: Checklist[] = existingChecklists;
      if (existingChecklists.length === 0 && masterSubGroup && masterSubGroup.checklists.length > 0 && cleanedExistingGroups.length === 0) {
        mergedChecklists = masterSubGroup.checklists;
        changed = true;
      } else {
        mergedChecklists = existingChecklists.map((existingChecklist) => {
          const existingItems = existingChecklist.items || [];
          const cleanedItems: ChecklistItem[] = existingItems.map((item, idx) => ({
            ...item,
            sequenceOrder: item.sequenceOrder || idx + 1,
            status: item.status || 'not_done',
            isMandatory: item.isMandatory !== false,
          }));

          const isComplete =
            cleanedItems.length > 0 &&
            cleanedItems.filter((it) => it.isMandatory).every((it) => it.status === 'done' || it.status === 'skipped');
          const hasStarted = cleanedItems.some((it) => it.status === 'done' || it.status === 'skipped');

          const newStatus = isComplete
            ? 'completed'
            : hasStarted
            ? 'in_progress'
            : existingChecklist.status === 'completed' || existingChecklist.status === 'in_progress'
            ? existingChecklist.status
            : 'pending';

          return {
            ...existingChecklist,
            status: newStatus,
            items: cleanedItems,
          };
        });
      }

      return {
        ...existingSubGroup,
        checklists: mergedChecklists,
      };
    });

    return {
      ...existingGroup,
      subGroups: mergedSubGroups,
    };
  });

  // Only inject missing master groups if the day data has 0 existing groups (uninitialized brand-new date)
  if (cleanedExistingGroups.length === 0) {
    const existingGroupCodes = new Set(cleanedExistingGroups.map((g) => g.code.toUpperCase()));
    const missingMasterGroups = masterGroups.filter((mg) => !existingGroupCodes.has(mg.code.toUpperCase()));

    if (missingMasterGroups.length > 0) {
      changed = true;
      mergedGroups.push(...missingMasterGroups);
    }
  }

  const merged: DayOperationalData = sanitizeDayData({
    date: dateStr,
    groups: mergedGroups,
    isShiftClosed: existing.isShiftClosed || false,
    closedBy: existing.closedBy,
    closedAt: existing.closedAt,
    shiftNotes: existing.shiftNotes,
    lastUpdated: existing.lastUpdated || new Date().toISOString(),
  });

  return { merged, changed };
}

// Generate upcoming rolling date window array (e.g. next 10 days)
export function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getUpcomingDateStrings(startDateStr?: string, daysCount: number = 10): string[] {
  let baseDate: Date;
  if (startDateStr) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    baseDate = new Date(y, (m || 1) - 1, d || 1);
  } else {
    baseDate = new Date();
  }

  const dates: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// Calculate cutoff date string for 1-month purge retention policy (e.g. 30 days ago)
export function getPurgeCutoffDateString(retentionDays: number = 30): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const yyyy = cutoff.getFullYear();
  const mm = String(cutoff.getMonth() + 1).padStart(2, '0');
  const dd = String(cutoff.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function createInitialDayData(dateStr: string): DayOperationalData {
  return sanitizeDayData({
    date: dateStr,
    groups: generateDefaultGroups(),
    isShiftClosed: false,
    lastUpdated: `${dateStr}T00:00:00.000Z`,
  });
}
