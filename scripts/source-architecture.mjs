import ts from 'typescript';
import { posix } from 'node:path';

/** Inspect authored TypeScript imports without executing application code. */
export function analyzeArchitecture(sources) {
  const errors = [];
  const edges = [];
  const paths = new Set(Object.keys(sources));
  function record(from, specifier, typeOnly) {
    if (!specifier.startsWith('.')) return;
    const base = posix.normalize(posix.join(posix.dirname(from), specifier));
    const target = [base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}/index.ts`].find((path) =>
      paths.has(path),
    );
    const isFrontend = from.startsWith('frontend/src/');
    if (
      (isFrontend && base.startsWith('backend/')) ||
      (!isFrontend && base.startsWith('frontend/'))
    )
      errors.push(`Cross-package source import: ${from} -> ${specifier}; use @sahmati/contracts`);
    if (!target) return;
    edges.push({ from, to: target, typeOnly });
    if (
      from.startsWith('frontend/src/app/core/') &&
      target.startsWith('frontend/src/app/features/')
    )
      errors.push(`Frontend core depends on a feature: ${from} -> ${target}`);
    if (
      from.startsWith('frontend/src/app/features/') &&
      target.startsWith('frontend/src/app/features/') &&
      from.split('/')[4] !== target.split('/')[4]
    )
      errors.push(`Frontend feature imports another feature: ${from} -> ${target}`);
    if (
      from.startsWith('backend/src/') &&
      !from.startsWith('backend/src/api/') &&
      target.startsWith('backend/src/api/')
    )
      errors.push(`Backend implementation imports compatibility API: ${from} -> ${target}`);
    if (
      from.includes('/constants/') &&
      !target.includes('/constants/') &&
      !target.includes('/locales/') &&
      !target.includes('/environments/')
    )
      errors.push(`Constants depend on runtime implementation: ${from} -> ${target}`);
    if (
      from.endsWith('.controller.ts') &&
      (target.includes('/database/') || target.endsWith('.repository.ts'))
    )
      errors.push(`Controller depends on persistence: ${from} -> ${target}`);
    if (
      from.endsWith('.repository.ts') &&
      !target.startsWith('backend/src/database/') &&
      /\.(service|controller)\.ts$/.test(target)
    )
      errors.push(`Repository depends on a higher layer: ${from} -> ${target}`);
  }
  for (const [file, source] of Object.entries(sources)) {
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const bindings = node.importClause?.namedBindings ?? node.exportClause;
        const allNamedTypes =
          bindings &&
          (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
          !node.importClause?.name &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly);
        record(
          file,
          node.moduleSpecifier.text,
          !!(node.isTypeOnly || node.importClause?.isTypeOnly || allNamedTypes),
        );
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        record(file, node.arguments[0].text, false);
      if (
        file.startsWith('frontend/') &&
        file.endsWith('.component.ts') &&
        ts.isImportDeclaration(node) &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some(
          (item) => item.propertyName?.text === 'HttpClient' || item.name.text === 'HttpClient',
        )
      )
        errors.push(`Angular component imports HttpClient directly: ${file}`);
      ts.forEachChild(node, visit);
    }
    visit(syntax);
  }
  const graph = new Map(Object.keys(sources).map((file) => [file, []]));
  for (const edge of edges.filter((edge) => !edge.typeOnly)) graph.get(edge.from).push(edge.to);
  const visited = new Set();
  const active = new Set();
  function walk(file, chain) {
    if (active.has(file)) {
      errors.push(
        `Runtime import cycle: ${[...chain.slice(chain.indexOf(file)), file].join(' -> ')}`,
      );
      return;
    }
    if (visited.has(file)) return;
    active.add(file);
    for (const target of graph.get(file)) walk(target, [...chain, file]);
    active.delete(file);
    visited.add(file);
  }
  for (const file of graph.keys()) walk(file, []);
  return { errors: [...new Set(errors)], edges };
}

/** Read Angular component metadata rather than matching unrelated identifiers or ternaries. */
export function componentResources(file, source) {
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const result = { inline: false, templateUrl: null, styleUrl: null };
  function visit(node) {
    if (
      ts.isDecorator(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(syntax) === 'Component'
    ) {
      const metadata = node.expression.arguments[0];
      if (metadata && ts.isObjectLiteralExpression(metadata))
        for (const property of metadata.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name.getText(syntax).replace(/^['"]|['"]$/g, '');
          if (name === 'template' || name === 'styles') result.inline = true;
          if (
            (name === 'templateUrl' || name === 'styleUrl') &&
            ts.isStringLiteral(property.initializer)
          )
            result[name] = property.initializer.text;
        }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return result;
}
