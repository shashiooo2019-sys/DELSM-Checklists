const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const config = require('../firebase-applet-config.json');

const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function inspect() {
  console.log('Inspecting daily_shifts for 2026-08-23...');
  const docSnap = await getDoc(doc(db, 'daily_shifts', '2026-08-23'));
  console.log('2026-08-23 exists?', docSnap.exists());
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log('Keys:', Object.keys(data));
    console.log('Date:', data.date, 'Status:', data.status);
    if (data.raw_data) {
      const parsed = JSON.parse(data.raw_data);
      console.log('Groups count:', parsed.groups ? parsed.groups.length : 0);
      if (parsed.groups) {
        parsed.groups.forEach(g => {
          const subCount = g.subGroups ? g.subGroups.length : 0;
          const chkCount = g.subGroups ? g.subGroups.reduce((acc, s) => acc + (s.checklists ? s.checklists.length : 0), 0) : 0;
          console.log(`  Group [${g.code || g.id}] "${g.name}": ${subCount} sub-groups, ${chkCount} checklists`);
          if (subCount > 0) {
            g.subGroups.forEach(s => {
              console.log(`    SubGroup: "${s.name}" (${s.checklists ? s.checklists.length : 0} checklists)`);
              if (s.checklists) {
                s.checklists.forEach(c => {
                  console.log(`      Checklist: "${c.title}" (${c.items ? c.items.length : 0} items)`);
                  if (c.items) {
                    c.items.forEach(it => console.log(`        - [${it.status}] ${it.text}`));
                  }
                });
              }
            });
          }
        });
      }
    }
  }
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
