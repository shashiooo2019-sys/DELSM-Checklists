const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');
const config = require('../firebase-applet-config.json');

const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function dump() {
  const docSnap = await getDoc(doc(db, 'daily_shifts', '2026-08-23'));
  if (!docSnap.exists()) {
    console.log('2026-08-23 does not exist!');
    return;
  }
  const data = docSnap.data();
  if (data.raw_data) {
    fs.writeFileSync('scripts/aug23_raw.json', data.raw_data, 'utf8');
    console.log('Saved aug23_raw.json successfully!');
  }
}

dump().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
