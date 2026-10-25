const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc, serverTimestamp } = require('firebase/firestore');
const config = require('../firebase-applet-config.json');

const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

const FLIGHT_CODES = ['LX147', 'LH763', 'LH761'];

function cleanGroups(groups) {
  if (!groups || !Array.isArray(groups)) return [];
  return groups
    .filter((g) => {
      const codeUpper = (g.code || '').trim().toUpperCase();
      const idLower = (g.id || '').trim().toLowerCase();
      const nameUpper = (g.name || '').trim().toUpperCase();
      if (codeUpper === 'LX2647' || idLower === 'grp-lx2647' || nameUpper.includes('LX2647')) {
        return false;
      }
      return true;
    })
    .map((g) => {
      const isFlight =
        g.isFlightGroup ||
        FLIGHT_CODES.some((fc) => fc.toUpperCase() === (g.code || '').toUpperCase());

      return {
        ...g,
        subGroups: (g.subGroups || []).map((sub) => {
          if (isFlight) {
            const filteredChecklists = (sub.checklists || []).filter((chk) => {
              const titleLower = chk.title.trim().toLowerCase();
              const idLower = chk.id.trim().toLowerCase();
              if (
                titleLower.includes('crew clearance') ||
                idLower.includes('crew-clearance') ||
                titleLower.includes('immig clearance') ||
                idLower.includes('immig-clearance')
              ) {
                return false;
              }
              return true;
            });
            return {
              ...sub,
              checklists: filteredChecklists,
            };
          }
          return sub;
        }),
      };
    });
}

async function runMigration() {
  console.log('--- Starting Firestore Migration: Remove LX2647 & Limit Flights to 3 Checklists ---');

  // 1. Update manifest in templates_op_groups
  const manifestRef = doc(db, 'templates_op_groups', 'manifest');
  const manifestSnap = await getDoc(manifestRef);
  if (manifestSnap.exists()) {
    const manifestData = manifestSnap.data();
    if (manifestData.groups) {
      const cleaned = cleanGroups(manifestData.groups);
      await setDoc(
        manifestRef,
        {
          groups: cleaned,
          total_groups: cleaned.length,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`Updated templates_op_groups/manifest with ${cleaned.length} groups.`);
    }
  }

  // 2. Update all daily shifts
  const shiftsCol = collection(db, 'daily_shifts');
  const snapshot = await getDocs(shiftsCol);
  console.log(`Found ${snapshot.docs.length} shifts to inspect.`);

  let updatedCount = 0;
  for (const docSnap of snapshot.docs) {
    const shiftData = docSnap.data();
    let dayData = null;

    if (shiftData.raw_data) {
      try {
        dayData = JSON.parse(shiftData.raw_data);
      } catch (e) {
        console.warn(`Could not parse raw_data for ${docSnap.id}`);
      }
    }

    if (dayData && dayData.groups) {
      const originalGroupsCount = dayData.groups.length;
      const originalFlightChkCount = dayData.groups
        .filter((g) => g.isFlightGroup || FLIGHT_CODES.includes(g.code))
        .reduce((acc, g) => acc + (g.subGroups || []).reduce((sAcc, s) => sAcc + (s.checklists || []).length, 0), 0);

      const cleanedGroups = cleanGroups(dayData.groups);
      const newGroupsCount = cleanedGroups.length;
      const newFlightChkCount = cleanedGroups
        .filter((g) => g.isFlightGroup || FLIGHT_CODES.includes(g.code))
        .reduce((acc, g) => acc + (g.subGroups || []).reduce((sAcc, s) => sAcc + (s.checklists || []).length, 0), 0);

      if (originalGroupsCount !== newGroupsCount || originalFlightChkCount !== newFlightChkCount) {
        dayData.groups = cleanedGroups;
        dayData.lastUpdated = new Date().toISOString();

        const shiftStatus = dayData.isShiftClosed
          ? 'CLOSED'
          : dayData.groups.every((g) => g.isVerified)
          ? 'VERIFIED'
          : 'IN_PROGRESS';

        await setDoc(
          docSnap.ref,
          {
            status: shiftStatus,
            raw_data: JSON.stringify(dayData),
            last_updated: serverTimestamp(),
          },
          { merge: true }
        );
        updatedCount++;
        console.log(`Updated shift ${docSnap.id}: groups ${originalGroupsCount} -> ${newGroupsCount}, flight checklists ${originalFlightChkCount} -> ${newFlightChkCount}`);
      }
    }
  }

  console.log(`Migration complete! Successfully migrated ${updatedCount} shifts.`);
}

runMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
