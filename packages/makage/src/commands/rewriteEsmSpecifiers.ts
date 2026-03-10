import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

type TypeScriptModule = typeof import('typescript');

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

interface RewriteEsmSpecifierArgs {
  tsconfigPath: string;
}

const DEFAULT_TSCONFIG_PATH = 'tsconfig.esm.json';
const HAS_EXTENSION_RE = /\.(js|mjs|cjs|json)$/;
export async function runRewriteEsmSpecifiers(args: string[]) {
  const parsed = parseArgs(args);
  await rewriteEsmSpecifiersForProject(parsed.tsconfigPath);
}

function parseArgs(args: string[]): RewriteEsmSpecifierArgs {
  const positional: string[] = [];
  let tsconfigPath = DEFAULT_TSCONFIG_PATH;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--project') {
      const value = args[++i];
      if (!value) {
        throw new Error('rewrite-esm-specifiers requires --project <file>');
      }
      tsconfigPath = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`rewrite-esm-specifiers does not support option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 1) {
    throw new Error('rewrite-esm-specifiers accepts at most one tsconfig path');
  }

  if (positional.length === 1) {
    tsconfigPath = positional[0];
  }

  return { tsconfigPath };
}


function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function resolveSpecifier(specifier: string, fileDir: string): string {
  if (!isRelativeSpecifier(specifier) || HAS_EXTENSION_RE.test(specifier)) {
    return specifier;
  }

  const abs = resolve(fileDir, specifier);

  if (existsSync(abs + '.js')) {
    return specifier + '.js';
  }

  if (existsSync(join(abs, 'index.js'))) {
    return specifier + '/index.js';
  }

  return specifier;
}

function collectSpecifierEdits(
  ts: TypeScriptModule,
  sourceFile: import('typescript').SourceFile,
  fileDir: string
): TextEdit[] {
  const edits: TextEdit[] = [];

  const queueEdit = (node: import('typescript').StringLiteral) => {
    const nextSpecifier = resolveSpecifier(node.text, fileDir);
    if (nextSpecifier === node.text) {
      return;
    }

    edits.push({
      start: node.getStart(sourceFile) + 1,
      end: node.getEnd() - 1,
      text: nextSpecifier,
    });
  };

  const visit = (node: import('typescript').Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      queueEdit(node.moduleSpecifier);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      queueEdit(node.moduleSpecifier);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      queueEdit(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return edits;
}

function rewriteSpecifiers(
  ts: TypeScriptModule,
  content: string,
  filePath: string
): string {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const edits = collectSpecifierEdits(ts, sourceFile, dirname(filePath));

  if (edits.length === 0) {
    return content;
  }

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (rewritten, edit) => rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end),
      content
    );
}

async function walkJs(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJs(full)));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }

  return files;
}

function resolveOutDir(tsconfigPath: string, ts: TypeScriptModule): string | null {
  const fullPath = resolve(process.cwd(), tsconfigPath);
  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const configFile = ts.readConfigFile(fullPath, ts.sys.readFile);
    if (configFile.error) {
      return null;
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dirname(fullPath),
      undefined,
      fullPath
    );
    const outDir = parsed.options.outDir;

    if (!outDir) {
      return null;
    }

    return isAbsolute(outDir) ? outDir : resolve(dirname(fullPath), outDir);
  } catch {
    return null;
  }
}

async function rewriteEsmSpecifiersForProject(tsconfigPath: string): Promise<void> {
  const ts: TypeScriptModule = require('typescript');
  const absOutDir = resolveOutDir(tsconfigPath, ts);

  if (!absOutDir) {
    console.log(`[makage] could not resolve outDir from ${tsconfigPath}, skipping ESM specifier rewrite`);
    return;
  }

  if (!existsSync(absOutDir)) {
    console.log(`[makage] outDir "${absOutDir}" not found, skipping ESM specifier rewrite`);
    return;
  }

  const jsFiles = await walkJs(absOutDir);
  const rewrittenCount = jsFiles.reduce((count, file) => {
    const original = readFileSync(file, 'utf-8');
    const rewritten = rewriteSpecifiers(ts, original, file);

    if (rewritten === original) {
      return count;
    }

    writeFileSync(file, rewritten, 'utf-8');
    return count + 1;
  }, 0);

  console.log(`[makage] rewrote ESM specifiers in ${rewrittenCount} file(s)`);
}
