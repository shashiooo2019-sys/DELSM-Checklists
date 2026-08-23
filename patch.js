const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/grp\.name === 'Day Shift Operations'/g, "(grp.name === 'Day Shift Operations' || grp.name === 'Day Shift')");
  content = content.replace(/groupName === 'Day Shift Operations'/g, "(groupName === 'Day Shift Operations' || groupName === 'Day Shift')");
  fs.writeFileSync(file, content);
  console.log('Patched', file);
}

patchFile('components/SupervisorDiagnosisModal.tsx');
patchFile('lib/storage.ts');
