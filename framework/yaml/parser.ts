import { parseDocument, visit, isAlias } from 'yaml';

export const MAX_YAML_BYTES = 1_048_576;

/** Parse one document; never include source snippets (which may contain secrets) in errors. */
export function parseYaml(source: string, filePath: string): unknown {
  if (Buffer.byteLength(source, 'utf8') > MAX_YAML_BYTES) {
    throw new Error(`${filePath}: /: YAML exceeds the 1 MiB limit`);
  }
  const document = parseDocument(source, { schema: 'core', uniqueKeys: true, prettyErrors: false });
  const issue = document.errors[0] ?? document.warnings[0];
  if (issue) {
    const line = issue.linePos?.[0];
    throw new Error(
      `${filePath}: /: YAML ${issue.code}${line ? ` at line ${line.line}, column ${line.col}` : ''}`,
    );
  }
  visit(document, {
    Node(_key, node, path) {
      if (path.length > 64) throw new Error(`${filePath}: /: YAML nesting exceeds 64 levels`);
      if (isAlias(node) || ('anchor' in node && node.anchor) || node.tag) {
        throw new Error(`${filePath}: /: YAML aliases, anchors and explicit tags are unsupported`);
      }
    },
  });
  return document.toJS({ maxAliasCount: 0 }) as unknown;
}
