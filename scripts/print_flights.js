const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('scripts/aug23_raw.json', 'utf8'));

for (let i = 0; i < 5; i++) {
  const g = raw.groups[i];
  console.log(`\n=== Group [${g.code || g.id}] "${g.name}" ===`);
  (g.subGroups || []).forEach(s => {
    console.log(`  SubGroup [${s.id}] "${s.name}"`);
    (s.checklists || []).forEach(c => {
      console.log(`    Checklist [${c.id}] "${c.title}" (${c.items ? c.items.length : 0} items)`);
      (c.items || []).forEach(it => {
        console.log(`      * [seq ${it.sequenceOrder}] [mand: ${it.isMandatory}] ${it.text.substring(0, 60)}...`);
      });
    });
  });
}
