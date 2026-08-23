const fs = require('fs');

const path = 'lib/initialData.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace passwordHash: 'U12345220!' with passwordHash: 'U12345'
code = code.replace(/passwordHash:\s*'((?:U|u)\d+)220!'/g, "passwordHash: '$1'");

// Replace mustChangePassword: true with mustChangePassword: false
code = code.replace(/mustChangePassword:\s*true/g, "mustChangePassword: false");

fs.writeFileSync(path, code);
console.log('Fixed initialData.ts');
