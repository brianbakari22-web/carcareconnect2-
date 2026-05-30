const fs = require('fs');
let c = fs.readFileSync('src/components/shared/Layout.jsx', 'utf8');
const old = '{bottomNav.map(item=>(\n            <button key={item.path}\n              onClick={()=>navigate(item.path)}';
const neu = old.replace(old, '');
if (c.includes('{bottomNav.map')) { console.log('found'); } else { console.log('not found'); }
fs.writeFileSync('src/components/shared/Layout.jsx', c, 'utf8');
