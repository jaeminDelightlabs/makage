import fs from 'node:fs';
import fsp from 'node:fs/promises';
import module from 'node:module';
import { runRewriteEsmSpecifiers } from '../src/commands/rewriteEsmSpecifiers';

jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('node:child_process');
jest.mock('node:module');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedFsPromises = fsp as jest.Mocked<typeof fsp>;
const mockedModule = module as jest.Mocked<typeof module>;
const mockCreateSourceFile = jest.fn();

describe('runRewriteEsmSpecifiers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedModule.createRequire.mockReturnValue((jest.fn().mockReturnValue)({
      ScriptKind: { JS: 'JS' },
      ScriptTarget: { Latest: 'Latest' },
      SyntaxKind: { ImportKeyword: 'ImportKeyword' },
      sys: { readFile: jest.fn() },
      readConfigFile: jest.fn().mockReturnValue({ config: {} }),
      parseJsonConfigFileContent: jest.fn().mockReturnValue({
        options: { outDir: 'dist/esm' },
      }),
      createSourceFile: mockCreateSourceFile,
      isImportDeclaration: (node: any) => node.kind === 'ImportDeclaration',
      isExportDeclaration: (node: any) => node.kind === 'ExportDeclaration',
      isCallExpression: (node: any) => node.kind === 'CallExpression',
      isStringLiteral: (node: any): node is any => node?.kind === 'StringLiteral',
      forEachChild: (node: any, cb: (child: any) => void) => {
        for (const child of node.children ?? []) {
          cb(child);
        }
      },
    }) as any);
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.readFileSync.mockReturnValue('' as any);
  });

  it('should rewrite relative specifiers with .js extension', async () => {
    const content = "import { x } from './ascii';";
    mockCreateSourceFile.mockReturnValue({
      kind: 'SourceFile',
      children: [{
        kind: 'ImportDeclaration',
        moduleSpecifier: {
          kind: 'StringLiteral', text: './ascii',
          getStart: () => content.indexOf("'./ascii'"),
          getEnd: () => content.indexOf("'./ascii'") + "'./ascii'".length,
        },
      }],
    });
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(content as any);
    mockedFsPromises.readdir.mockResolvedValue([
      { name: 'index.js', isDirectory: () => false } as any,
    ]);

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dist/esm/index.js'), "import { x } from './ascii.js';", 'utf-8'
    );
  });

  it('should rewrite directory specifiers with /index.js', async () => {
    const content = "export * from './types';";
    mockCreateSourceFile.mockReturnValue({
      kind: 'SourceFile',
      children: [{
        kind: 'ExportDeclaration',
        moduleSpecifier: {
          kind: 'StringLiteral', text: './types',
          getStart: () => content.indexOf("'./types'"),
          getEnd: () => content.indexOf("'./types'") + "'./types'".length,
        },
      }],
    });
    mockedFs.existsSync.mockImplementation(p =>
      !String(p).endsWith('types.js')
    );
    mockedFs.readFileSync.mockReturnValue(content as any);
    mockedFsPromises.readdir.mockResolvedValue([
      { name: 'index.js', isDirectory: () => false } as any,
    ]);

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dist/esm/index.js'), "export * from './types/index.js';", 'utf-8'
    );
  });

  it('should rewrite dynamic import specifiers', async () => {
    const content = "const dyn = await import('./dynamic');";
    mockCreateSourceFile.mockReturnValue({
      kind: 'SourceFile',
      children: [{
        kind: 'CallExpression',
        expression: { kind: 'ImportKeyword' },
        arguments: [{
          kind: 'StringLiteral', text: './dynamic',
          getStart: () => content.indexOf("'./dynamic'"),
          getEnd: () => content.indexOf("'./dynamic'") + "'./dynamic'".length,
        }],
      }],
    });
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(content as any);
    mockedFsPromises.readdir.mockResolvedValue([
      { name: 'index.js', isDirectory: () => false } as any,
    ]);

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('dist/esm/index.js'), "const dyn = await import('./dynamic.js');", 'utf-8'
    );
  });

  it('should not touch already-extensioned specifiers', async () => {
    const content = "import { x } from './foo.js';";
    mockCreateSourceFile.mockReturnValue({
      kind: 'SourceFile',
      children: [{
        kind: 'ImportDeclaration',
        moduleSpecifier: {
          kind: 'StringLiteral', text: './foo.js',
          getStart: () => content.indexOf("'./foo.js'"),
          getEnd: () => content.indexOf("'./foo.js'") + "'./foo.js'".length,
        },
      }],
    });
    mockedFs.readFileSync.mockReturnValue(content as any);
    mockedFsPromises.readdir.mockResolvedValue([
      { name: 'index.js', isDirectory: () => false } as any,
    ]);

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should not touch bare package imports', async () => {
    const content = "import { something } from 'lodash';";
    mockCreateSourceFile.mockReturnValue({
      kind: 'SourceFile',
      children: [{
        kind: 'ImportDeclaration',
        moduleSpecifier: {
          kind: 'StringLiteral', text: 'lodash',
          getStart: () => content.indexOf("'lodash'"),
          getEnd: () => content.indexOf("'lodash'") + "'lodash'".length,
        },
      }],
    });
    mockedFs.readFileSync.mockReturnValue(content as any);
    mockedFsPromises.readdir.mockResolvedValue([
      { name: 'index.js', isDirectory: () => false } as any,
    ]);

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should skip when outDir does not exist', async () => {
    mockedFs.existsSync.mockImplementation(p =>
      String(p).endsWith('tsconfig.esm.json')
    );
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found, skipping ESM specifier rewrite')
    );
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should skip when tsconfig does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    await runRewriteEsmSpecifiers(['--project', 'tsconfig.esm.json']);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('skipping ESM specifier rewrite')
    );
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
