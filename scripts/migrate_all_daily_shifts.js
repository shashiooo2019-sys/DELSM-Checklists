const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForInitialBuildOnly_ReplaceInConsole",
  authDomain: "studio-ai-aviation-dev.firebaseapp.com",
  projectId: "studio-ai-aviation-dev",
  storageBucket: "studio-ai-aviation-dev.appspot.com",
  messagingSenderId: "100000000000",
  appId: "1:100000000000:web:abcdef1234567890",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const masterTemplate = JSON.parse(fs.readFileSync('scripts/master_template_definition.json', 'utf8'));

// Helper to build a clean copy of master template groups
function createMasterGroups() {
  return JSON.parse(JSON.stringify(masterTemplate));
}

async function runMigration() {
  console.log('Fetching all documents in daily_shifts...');
  const shiftsCol = collection(db, 'daily_shifts');
  const snapshot = await getDocs(shiftsCol);
  
  console.log(`Found ${snapshot.docs.length} documents in daily_shifts.`);
  
  for (const docSnap of snapshot.docs) {
    const dateStr = docSnap.id;
    console.log(`Processing date: ${dateStr}`);
    const data = docSnap.data();
    
    let dayData;
    if (data.raw_data) {
      try {
        dayData = JSON.parse(data.raw_data);
      } catch (e) {
        console.warn(`Could not parse raw_data for ${dateStr}, initializing fresh`);
      }
    }
    
    if (!dayData || !dayData.groups || dayData.groups.length === 0) {
      dayData = {
        date: dateStr,
        groups: createMasterGroups(),
        isShiftClosed: data.status === 'CLOSED',
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Ensure all 9 master groups exist and have their complete subGroups and checklists
      const masterGroups = createMasterGroups();
      
      const updatedGroups = masterGroups.map((masterGroup) => {
        const existingGroup = dayData.groups.find(
          (g) => g.id === masterGroup.id || g.code === masterGroup.code
        );
        
        if (!existingGroup) {
          return masterGroup;
        }
        
        // If existing group has subGroups with checklists, merge user progress if present
        if (existingGroup.subGroups && existingGroup.subGroups.length > 0) {
          // Check if checklists exist inside subGroups
          const hasChecklists = existingGroup.subGroups.some(
            (sg) => sg.checklists && sg.checklists.length > 0
          );
          if (hasChecklists) {
            // Group already has checklists! Keep it (preserving user progress)
            return existingGroup;
          }
        }
        
        // If subGroups was empty, replace subGroups with master subGroups
        return {
          ...existingGroup,
          subGroups: masterGroup.subGroups
        };
      });
      
      dayData.groups = updatedGroups;
    }
    
    // Save updated raw_data back to Firestore
    await setDoc(doc(db, 'daily_shifts', dateStr), {
      date: dateStr,
      status: dayData.isShiftClosed ? 'CLOSED' : (dayData.groups.every(g => g.isVerified) ? 'VERIFIED' : 'IN_PROGRESS'),
      raw_data: JSON.stringify(dayData),
      last_updated: new Date()
    }, { merge: true });
    
    console.log(`Successfully migrated ${dateStr}`);
  }
  
  console.log('Migration finished successfully!');
}

runMigration().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
