const fs = require('fs');
const file = 'apps/web/components/assets-dashboard.tsx';
let content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');
const fixedLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (i === 161) {
        skip = true;
    }
    
    if (i === 229) {
        skip = false;
        continue;
    }
    
    if (!skip) {
        fixedLines.push(line);
    }
}
fs.writeFileSync(file, fixedLines.join('\n'), 'utf-8');
console.log('Fixed lines 162-229');
