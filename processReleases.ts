import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { simpleGit } from 'simple-git';

const promisifiedExec = promisify(exec);
const pwd = import.meta.dirname;

const github = 'https://github.com/software-mansion/TypeGPU.git';
const scriptToRun =
  'pnpm install && ATTEST_skipTypes=1 pnpm vitest run apps/typegpu-docs/tests/benchmark.test.ts 2> /dev/null';
const debugScriptToRun =
  'pnpm install && ATTEST_skipTypes=1 DEBUG=1 pnpm vitest run apps/typegpu-docs/tests/benchmark.test.ts 2> /dev/null';
const scriptToInstallDOM = 'pnpm add --dir apps/typegpu-docs -d jsdom';
const benchmarksDir = 'benchmarks';
const runningTimesDir = 'example-running-times';
const timestampsDir = 'timestamps';
const tmpDir = path.join(pwd, 'tmp');
const firstTagWithPERF = 'v0.6.0';
const includeNotStable = false;
const regexNotStable = /[a-z]/i;
const lastReleaseWithoutMocks = 'v0.7.1';

// relative to the root of cloned repo
const pathToInjectVitest = 'apps/typegpu-docs/vitest.config.mts';
const pathToInjectBenchmark = 'apps/typegpu-docs/tests/benchmark.test.ts';
const pathToInjectExtendedIt = 'packages/typegpu/tests/utils/extendedIt.ts';
const pathToInjectTestUtils =
  'packages/typegpu/tests/examples/utils/testUtils.ts';
const pathToInjectExamplesUtils = 'packages/typegpu/tests/examples/';

const git = simpleGit();

async function getTags(): Promise<string[]> {
  const tagsResult = await git.listRemote(['--tags', github]);
  if (!tagsResult) {
    console.warn('Could not fetch tags from the repository.');
  }

  return tagsResult
    .split('\n')
    .map((line) => line.split('refs/tags/').pop()?.trim())
    .filter((tag): tag is string =>
      !!tag && !tag.includes('{}') &&
      (!regexNotStable.test(tag.slice(1)) || includeNotStable) &&
      tag.localeCompare(firstTagWithPERF) >= 0
    )
    .sort();
}

async function cloneRepo(tag: string) {
  try {
    await git.clone(github, path.join(tmpDir, tag), [
      '--depth=1',
      `--branch=${tag}`,
    ]);
  } catch (_) {
    console.warn(`Cloning tag ${tag} failed.`);
  }
}

async function processModernRelease(repoPath: string) {
  return Promise.all([
    // enable vitest to see our script
    fs.copyFile(
      'templates/vitest.config.mts.template',
      path.join(repoPath, pathToInjectVitest),
    ),
    // copy our script
    fs.copyFile(
      process.env.DEBUG === '1'
        ? 'templates/benchmark.test.ts.template.new.debug'
        : 'templates/benchmark.test.ts.template.new',
      path.join(repoPath, pathToInjectBenchmark),
    ),
    // disables caching
    fs.copyFile(
      'templates/testUtils.ts.template.new',
      path.join(repoPath, pathToInjectTestUtils),
    ),
  ]);
}

async function processOlderRelease(repoPath: string) {
  return Promise.all([
    // enable vitest to see our script
    fs.copyFile(
      'templates/vitest.config.mts.template',
      path.join(repoPath, pathToInjectVitest),
    ),
    // copy mocks
    fs.copy(
      'templates/examples',
      path.join(repoPath, pathToInjectExamplesUtils),
    ),
    // extend it
    fs.copyFile(
      'templates/extendedIt.ts.template.old',
      path.join(repoPath, pathToInjectExtendedIt),
    ),
    // copy our script
    fs.copyFile(
      'templates/benchmark.test.ts.template.old',
      path.join(repoPath, pathToInjectBenchmark),
    ),
  ]);
}

async function runScript(repoPath: string) {
  try {
    // sometimes there is a problem with missing jsdom
    await promisifiedExec(scriptToInstallDOM, {
      cwd: repoPath,
    });

    await promisifiedExec(
      (process.env.DEBUG === '1') ? debugScriptToRun : scriptToRun,
      {
        cwd: repoPath,
      },
    );
  } catch (error) {
    console.warn('Running pnpm script failed.');
    console.log(error);
  }
}

// debug variables
let start: number;
let end: number;

async function processReleases() {
  try {
    if (process.env.DEBUG === '1') {
      console.log(
        `[DEBUG] timestamp of start of processReleases: ${performance.now()}`,
      );
    }

    await fs.ensureDir(tmpDir);

    start = performance.now();
    const tags = await getTags();
    end = performance.now();

    if (process.env.DEBUG === '1') {
      console.log(
        `[DEBUG] timestamp of getting tags: ${performance.now()}`,
      );
      console.log(`[DEBUG] time of getting tags: ${end - start}`);
    }

    // process all tags
    for (const tag of tags.slice(tags.length - 2, tags.length - 1)) {
      start = performance.now();
      await cloneRepo(tag);
      end = performance.now();
      if (process.env.DEBUG === '1') {
        console.log(`[DEBUG] time of cloning ${tag}: ${end - start}`);
        console.log(
          `[DEBUG] timestamp of cloning tag ${tag}: ${performance.now()}`,
        );
      }

      const repoPath = path.join(tmpDir, tag);

      start = performance.now();
      if (tag.localeCompare(lastReleaseWithoutMocks) > 0) {
        await processModernRelease(repoPath);
      } else {
        await processOlderRelease(repoPath);
      }
      end = performance.now();
      if (process.env.DEBUG === '1') {
        console.log(
          `[DEBUG] time of injecting files into ${tag}: ${end - start}`,
        );
        console.log(
          `[DEBUG] timestamp of injecting files into tag ${tag}: ${performance.now()}`,
        );
      }

      if (process.env.DEBUG === '1') {
        console.log(
          `[DEBUG] timestamp before running script on ${tag}: ${performance.now()}`,
        );
      }

      start = performance.now();
      await runScript(repoPath);
      end = performance.now();
      if (process.env.DEBUG === '1') {
        console.log(
          `[DEBUG] time of running benchmark on ${tag}: ${end - start}`,
        );
        console.log(
          `[DEBUG] timestamp after running script on ${tag}: ${performance.now()}`,
        );
      }

      start = performance.now();
      await fs.copyFile(
        path.join(repoPath, 'example-benchmark.json'),
        `${benchmarksDir}/${tag}.json`,
      );
      if (process.env.DEBUG === '1') {
        await fs.copyFile(
          path.join(repoPath, 'example-runnning-times.json'),
          `${runningTimesDir}/${tag}.json`,
        );
        await fs.copyFile(
          path.join(repoPath, 'timestamps.json'),
          `${timestampsDir}/${tag}.json`,
        );
      }
      end = performance.now();
      if (process.env.DEBUG === '1') {
        console.log(
          `[DEBUG] time of copying result files on ${tag}: ${end - start}`,
        );
        console.log(
          `[DEBUG] timestamp after copying result files of ${tag}: ${performance.now()}`,
        );
      }
    }
  } catch (error) {
    console.warn('Something went wrong in outer try-catch.');
    console.log(error);
  } finally {
    if (process.env.DEBUG === '1') {
      console.log(
        `[DEBUG] timestamp before deleting tmp: ${performance.now()}`,
      );
    }
    await fs.remove(tmpDir);
    if (process.env.DEBUG === '1') {
      console.log(
        `[DEBUG] timestamp after deleting tmp: ${performance.now()}`,
      );
    }
  }
}

await processReleases();

if (process.env.DEBUG === '1') {
  console.log(
    `[DEBUG] timestamp after function processReleases: ${performance.now()}`,
  );
}
