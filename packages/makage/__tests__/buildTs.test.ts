import { spawn } from 'node:child_process';
import { runRewriteEsmSpecifiers } from '../src/commands/rewriteEsmSpecifiers';
import { runBuildTs } from '../src/commands/buildTs';

jest.mock('node:child_process');
jest.mock('../src/commands/rewriteEsmSpecifiers');

const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockedRunRewriteEsmSpecifiers = runRewriteEsmSpecifiers as jest.MockedFunction<typeof runRewriteEsmSpecifiers>;

describe('runBuildTs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSpawn.mockReturnValue({
      on: jest.fn((event, cb) => {
        if (event === 'exit') process.nextTick(() => cb(0));
      }),
    } as any);
    mockedRunRewriteEsmSpecifiers.mockResolvedValue(undefined);
  });

  it('should run CJS and ESM builds', async () => {
    await runBuildTs([]);

    expect(mockedSpawn).toHaveBeenCalledWith('tsc', [], expect.any(Object));
    expect(mockedSpawn).toHaveBeenCalledWith('tsc', ['-p', 'tsconfig.esm.json'], expect.any(Object));
    expect(mockedRunRewriteEsmSpecifiers).not.toHaveBeenCalled();
  });

  it('should call runRewriteEsmSpecifiers when --rewrite-esm-specifiers is passed', async () => {
    await runBuildTs(['--rewrite-esm-specifiers']);

    expect(mockedSpawn).toHaveBeenCalledTimes(2);
    expect(mockedRunRewriteEsmSpecifiers).toHaveBeenCalledWith(['--project', 'tsconfig.esm.json']);
  });

  it.each([
    [['--dev', '--rewrite-esm-specifiers']],
    [['--rewrite-esm-specifiers', '--dev']],
  ])('should handle flag order independently: %p', async (args) => {
    await runBuildTs(args);

    expect(mockedSpawn).toHaveBeenNthCalledWith(
      1,
      'tsc',
      ['--declarationMap'],
      expect.any(Object)
    );
    expect(mockedSpawn).toHaveBeenNthCalledWith(
      2,
      'tsc',
      ['-p', 'tsconfig.esm.json'],
      expect.any(Object)
    );
    expect(mockedRunRewriteEsmSpecifiers).toHaveBeenCalledWith(['--project', 'tsconfig.esm.json']);
  });
});
