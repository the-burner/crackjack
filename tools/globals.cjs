// Dev-only: list the globals a legacy reference function reads/writes.
// Usage: node tools/globals.cjs .reference/game/fn/CCLoad2.js [...]
const acorn = require('acorn'), walk = require('acorn-walk'), fs = require('fs');
const IGNORE = new Set(['True', 'False', 'undefined', 'Math', 'JSON', 'localStorage', 'window', 'document']);
for (const file of process.argv.slice(2)) {
  const ast = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  const locals = new Set();
  walk.full(ast, n => {
    if (n.type === 'VariableDeclarator') locals.add(n.id.name);
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') n.params.forEach(p => locals.add(p.name));
  });
  const reads = new Set(), writes = new Set(), calls = new Set();
  walk.ancestor(ast, {
    Identifier(n, anc) {
      if (locals.has(n.name) || IGNORE.has(n.name)) return;
      const p = anc[anc.length - 2];
      if (p.type === 'MemberExpression' && p.property === n && !p.computed) return;
      if (p.type === 'CallExpression' && p.callee === n) { calls.add(n.name); return; }
      let top = n;
      for (let i = anc.length - 2; i >= 0; i--) {
        const a = anc[i];
        if (a.type === 'MemberExpression' && a.object === top) { top = a; continue; }
        if ((a.type === 'AssignmentExpression' && a.left === top) || a.type === 'UpdateExpression') { writes.add(n.name); return; }
        break;
      }
      reads.add(n.name);
    },
  });
  console.log(`## ${file}\nREADS  ${[...reads].sort().join(' ')}\nWRITES ${[...writes].sort().join(' ')}\nCALLS  ${[...calls].sort().join(' ')}`);
}
