// Dev-only: extract and pretty-print the legacy apps' inline scripts into
// .reference/ so they can be read while porting. Not part of the app.
import fs from 'node:fs';
import path from 'node:path';
import beautify from 'js-beautify';

for (const app of ['drill', 'game']) {
  const html = fs.readFileSync(`legacy/${app}/index.html`, 'utf8');
  const out = `.reference/${app}`;
  fs.mkdirSync(out, { recursive: true });
  const blocks = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  blocks.forEach((m, i) => {
    const pretty = beautify.js(m[1], { indent_size: 2, max_preserve_newlines: 1 });
    fs.writeFileSync(path.join(out, `script-${String(i).padStart(2, '0')}.js`), pretty);
  });
  const markup = html.replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g, '<script>/*extracted*/</script>');
  fs.writeFileSync(path.join(out, 'markup.html'), beautify.html(markup, { indent_size: 2 }));
  console.log(app, blocks.length, 'scripts');
}
