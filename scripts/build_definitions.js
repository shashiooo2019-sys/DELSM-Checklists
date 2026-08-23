const fs = require('fs');
const template = JSON.parse(fs.readFileSync('scripts/master_template_definition.json', 'utf8'));

// Generate TypeScript code for master templates in lib/initialData.ts
let ts = `// Master Checklist Definitions for all Operational Days (as defined on 23-August)
import { SubOperationalGroup, OperationalGroup, Checklist, ChecklistItem } from '@/types/aviation';

export function makeItem(id: string, seq: number, text: string, isMandatory: boolean = true): ChecklistItem {
  return {
    id,
    sequenceOrder: seq,
    text,
    isMandatory,
    status: 'not_done',
  };
}

export const MASTER_FLIGHT_CHECKLISTS: { title: string; category?: string; items: { id: string; seq: number; text: string; mand: boolean }[] }[] = [
`;

// Extract from LX147
const lx147 = template.find(g => g.code === 'LX147');
lx147.subGroups[0].checklists.forEach(chk => {
  ts += `  {\n    title: ${JSON.stringify(chk.title)},\n    items: [\n`;
  chk.items.forEach(it => {
    ts += `      { id: ${JSON.stringify(it.id)}, seq: ${it.sequenceOrder}, text: ${JSON.stringify(it.text)}, mand: ${it.isMandatory !== false} },\n`;
  });
  ts += `    ],\n  },\n`;
});
ts += `];\n\n`;

// Extract non-flight checklists
const nonFlights = template.filter(g => !g.isFlightGroup);
ts += `export const MASTER_NON_FLIGHT_DEFINITIONS = [\n`;
nonFlights.forEach(g => {
  ts += `  {\n    groupId: ${JSON.stringify(g.id)},\n    groupName: ${JSON.stringify(g.name)},\n    groupCode: ${JSON.stringify(g.code)},\n    subGroupName: 'General Operations',\n    checklists: [\n`;
  g.subGroups.forEach(s => {
    s.checklists.forEach(chk => {
      ts += `      {\n        title: ${JSON.stringify(chk.title)},\n        items: [\n`;
      chk.items.forEach(it => {
        ts += `          { id: ${JSON.stringify(it.id)}, seq: ${it.sequenceOrder}, text: ${JSON.stringify(it.text)}, mand: ${it.isMandatory !== false} },\n`;
      });
      ts += `        ],\n      },\n`;
    });
  });
  ts += `    ],\n  },\n`;
});
ts += `];\n`;

fs.writeFileSync('scripts/generated_definitions.ts', ts, 'utf8');
console.log('generated_definitions.ts created successfully!');
