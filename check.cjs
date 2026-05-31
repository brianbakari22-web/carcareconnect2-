const fs = require('fs');
let content = fs.readFileSync('src/components/marketplace/MyListings.jsx', 'utf8');
const lines = content.split('
');
console.log('Total lines:', lines.length);
fs.writeFileSync('check.txt', lines[222] + '
' + lines[223], 'utf8');

