const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/aug23_raw.json', 'utf8'));
console.log('Date:', raw.date);
console.log('Total groups:', raw.groups.length);

raw.groups.forEach((g, idx) => {
  console.log(`\n=== Group [${g.code || g.id}] "${g.name}" (isFlightGroup: ${g.isFlightGroup}) ===`);
  (g.subGroups || []).forEach((s, sidx) => {
    console.log(`  SubGroup [${s.id}] "${s.name}"`);
    (s.checklists || []).forEach((c, cidx) => {
      console.log(`    Checklist [${c.id}] "${c.title}" (role: ${c.assignedRole || ''}, items: ${c.items ? c.items.length : 0})`);
      (c.items || []).forEach(it => {
        console.log(`      - [${it.id}] (seq: ${it.sequenceOrder}, mand: ${it.isMandatory}) ${it.text.substring(0, 70)}...`);
      });
    });
  });
});
