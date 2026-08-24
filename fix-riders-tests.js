const fs = require('fs');
let code = fs.readFileSync('server/src/riders/riders.service.spec.ts', 'utf8');
code = code.replace(/const readyOrder = \{([\s\S]*?)id: 1,/g, "const readyOrder = {$1id: 1,\n          deliveryOption: 'delivery',");
fs.writeFileSync('server/src/riders/riders.service.spec.ts', code);
