const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('scripts/aug23_raw.json', 'utf8'));

console.log('Total groups in Aug 23:', raw.groups.length);

const summary = raw.groups.map(g => {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    isFlightGroup: g.isFlightGroup,
    subGroups: (g.subGroups || []).map(s => ({
      id: s.id,
      name: s.name,
      checklists: (s.checklists || []).map(c => ({
        id: c.id,
        title: c.title,
        assignedRole: c.assignedRole,
        category: c.category,
        itemCount: (c.items || []).length,
        items: c.items || []
      }))
    }))
  };
});

fs.writeFileSync('scripts/master_template_definition.json', JSON.stringify(summary, null, 2), 'utf8');
console.log('Saved master_template_definition.json with full structure!');
