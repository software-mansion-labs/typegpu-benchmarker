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
const scriptToInstallDOM = 'pnpm add --dir apps/typegpu-docs -d jsdom';
const benchmarksDir = 'benchmarks';
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
      'templates/benchmark.test.ts.template.new',
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

    await promisifiedExec(scriptToRun, {
      cwd: repoPath,
    });
  } catch (error) {
    console.warn('Running pnpm script failed.');
    console.log(error);
  }
}

async function processRelease() {
  try {
    await fs.ensureDir(tmpDir);

    const tags = await getTags();

    // process all tags
    for (const tag of tags) {
      await cloneRepo(tag);

      const repoPath = path.join(tmpDir, tag);

      if (tag.localeCompare(lastReleaseWithoutMocks) > 0) {
        await processModernRelease(repoPath);
      } else {
        await processOlderRelease(repoPath);
      }

      await runScript(repoPath);

      await fs.copyFile(
        path.join(repoPath, 'example-benchmark.json'),
        `${benchmarksDir}/${tag}.json`,
      );
    }
  } catch (error) {
    console.warn('Something went wrong in outer try-catch.');
    console.log(error);
  } finally {
    await fs.remove(tmpDir);
  }
}

await processRelease();
