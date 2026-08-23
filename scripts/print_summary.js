const fs = require('fs');
const template = JSON.parse(fs.readFileSync('scripts/master_template_definition.json', 'utf8'));

template.forEach((g, i) => {
  console.log(`\n-----------------------------------------`);
  console.log(`[${i+1}] Group: ${g.name} (${g.code || g.id}) [isFlight: ${g.isFlightGroup}]`);
  g.subGroups.forEach((s, si) => {
    console.log(`  Sub-Group ${si+1}: "${s.name}" (ID: ${s.id})`);
    s.checklists.forEach((c, ci) => {
      console.log(`    Checklist ${ci+1}: "${c.title}" [${c.items.length} items] (Role: ${c.assignedRole || 'None'})`);
    });
  });
});
