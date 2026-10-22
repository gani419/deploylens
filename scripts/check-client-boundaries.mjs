import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['contracts', 'config', 'utils', 'reporting', 'store', 'api-client'];
const allowed = new Set(names.map(name => `@deploylens/${name}`));
const errors = [];
function checkImport(specifier, file, packageRoot) {
  if (specifier.startsWith('.')) {
    const target = path.resolve(path.dirname(file), specifier);
    if (!target.startsWith(packageRoot + path.sep)) errors.push(`${file}: cross-package source import ${specifier}`);
  } else if (!allowed.has(specifier) && specifier !== 'zod') errors.push(`${file}: platform dependency ${specifier}`);
}
function walk(directory, packageRoot) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(file, packageRoot); continue; }
    if (!file.endsWith('.ts')) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) checkImport(node.moduleSpecifier.text, file, packageRoot);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) errors.push(`${file}: non-literal runtime import`);
        else checkImport(node.arguments[0].text, file, packageRoot);
      }
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) checkImport(node.moduleReference.expression.text, file, packageRoot);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) checkImport(node.argument.literal.text, file, packageRoot);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
for (const name of names) {
  const packageRoot = path.join(root, 'packages', name);
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  for (const dependency of Object.keys(manifest.dependencies || {})) if (!allowed.has(dependency) && dependency !== 'zod') errors.push(`${name}: platform dependency ${dependency}`);
  walk(path.join(packageRoot, 'src'), packageRoot);
}
if (errors.length) { console.error(errors.map(error => error.replaceAll(root, '')).join('\n')); process.exitCode = 1; }
else console.log('Shared client package boundaries passed (no DOM UI, Node tools, or cross-package source imports).');
