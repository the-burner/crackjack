// Dev-only: split the legacy main scripts into one file per top-level
// statement/function with an index of what each references.
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import beautify from 'js-beautify';

for (const [app, main] of [['drill', 'script-22.js'], ['game', 'script-33.js']]) {
  const html = fs.readFileSync(`legacy/${app}/index.html`, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const src = blocks[Number(main.match(/\d+/)[0])].replace(/(\w)\((\w+(?:,\w+)*)\)=(?!=)/g, '$1[$2]=');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  const dir = `.reference/${app}/fn`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  let misc = [];
  const flushMisc = () => { if (misc.length) { const name = `_top_${String(rows.length).padStart(4, '0')}`; write(name, misc.join('\n')); misc = []; } };
  const write = (name, code) => {
    const ids = new Set();
    try { walk.full(acorn.parse(code, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }), n => { if (n.type === 'Identifier') ids.add(n.name); }); } catch {}
    fs.writeFileSync(`${dir}/${name}.js`, beautify.js(code, { indent_size: 2, max_preserve_newlines: 1 }));
    rows.push({ name, bytes: code.length, ids: [...ids] });
  };
  for (const node of ast.body) {
    const code = src.slice(node.start, node.end);
    let name = null;
    if (node.type === 'FunctionDeclaration') name = node.id.name;
    else if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
      const l = src.slice(node.expression.left.start, node.expression.left.end);
      if (node.expression.right.type === 'FunctionExpression' && /^[\w.]+$/.test(l)) name = l.replace(/\./g, '__');
    }
    if (name) { flushMisc(); write(name, code); } else misc.push(code);
  }
  flushMisc();
  const names = new Set(rows.map(r => r.name));
  const callers = {};
  for (const r of rows) for (const id of r.ids) if (names.has(id) && id !== r.name) (callers[id] ??= []).push(r.name);
  fs.writeFileSync(`.reference/${app}/fn-index.tsv`, rows.map(r => [r.name, r.bytes, (callers[r.name] || []).join(','), r.ids.filter(i => names.has(i) && i !== r.name).join(',')].join('\t')).join('\n'));
  console.log(app, rows.length, 'units');
}
