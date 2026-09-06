import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyBump, commitsSinceRelease, findReleaseBase } from '../scripts/bump-version.mjs';

const sources = fileURLToPath(new URL('../scripts/', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'chowa-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'repo');
  mkdirSync(join(cwd, '.claude-plugin'), { recursive: true });
  mkdirSync(join(cwd, 'scripts/lib'), { recursive: true });
  for (const path of ['bump-version.mjs', 'publish-release.sh', 'lib/direct-run.mjs']) {
    cpSync(join(sources, path), join(cwd, 'scripts', path));
  }
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.invalid');
  const manifest = join(cwd, '.claude-plugin/plugin.json');
  const version = (value) => writeFileSync(manifest, JSON.stringify({ version: value }) + '\n');
  const commit = (message) => { git('add', '.'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
  version('0.1.0'); commit('feat: old feature'); git('tag', 'v0.1.0');
  version('0.12.0'); const boundary = commit('chore(release): v0.12.0 [skip ci]');
  const change = (message) => { writeFileSync(join(cwd, 'change.txt'), message + '\n'); return commit(message); };
  const output = join(root, 'outputs');
  const plan = () => {
    writeFileSync(output, '');
    execFileSync(process.execPath, [join(cwd, 'scripts/bump-version.mjs')], {
      cwd, env: { ...process.env, GITHUB_OUTPUT: output }, stdio: 'pipe',
    });
    return Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map((line) => line.split('=')));
  };
  const remote = join(root, 'remote.git');
  git('init', '--bare', '-q', remote); git('remote', 'add', 'origin', remote);
  const publish = (outputs) => spawnSync('bash', [join(cwd, 'scripts/publish-release.sh')], {
    cwd, encoding: 'utf8', env: { ...process.env,
      RELEASE_VERSION: outputs.version, RELEASE_BUMPED: outputs.bumped,
      RELEASE_BASE_TAG: outputs.base_tag, RELEASE_BASE_SHA: outputs.base_sha,
      RELEASE_RESTORE_BASE: outputs.restore_base_tag,
    },
  });
  return { cwd, git, version, manifest, boundary, change, plan, publish };
}

test('a missing current tag uses the verified release commit, not an older feature tag', (t) => {
  const f = fixture(t); f.change('docs: improve README');
  const base = findReleaseBase('0.12.0', f.cwd);
  assert.deepEqual(base, { tag: 'v0.12.0', sha: f.boundary, restoreTag: true });
  assert.equal(classifyBump(commitsSinceRelease(base, f.cwd)), 'none');
  assert.equal(f.plan().bumped, 'false');
  assert.equal(JSON.parse(readFileSync(f.manifest)).version, '0.12.0');
});

test('an exact release tag must match its manifest and be an ancestor', (t) => {
  const f = fixture(t);
  f.git('tag', '-a', 'v0.12.0', '-m', 'Release 0.12.0');
  assert.equal(findReleaseBase('0.12.0', f.cwd).restoreTag, false);
  f.git('tag', 'v0.13.0');
  assert.throws(() => findReleaseBase('0.13.0', f.cwd), /does not match/);
  const orphan = f.git('commit-tree', 'HEAD^{tree}', '-m', 'unrelated history');
  f.git('tag', 'v0.14.0', orphan);
  assert.throws(() => findReleaseBase('0.14.0', f.cwd));
});

test('unverifiable release boundaries fail rather than replaying old commits', (t) => {
  const f = fixture(t);
  assert.throws(() => findReleaseBase('0.13.0', f.cwd), /No verified release boundary/);
  f.change('chore(release): v0.13.0 [skip ci]');
  assert.throws(() => findReleaseBase('0.13.0', f.cwd), /does not establish/);
  f.change('chore(release): v0.12.0 [skip ci]');
  assert.throws(() => findReleaseBase('0.12.0', f.cwd), /does not establish/);
});

test('new commit impact selects patch, minor, or major from the recovered boundary', (t) => {
  for (const [message, expected] of [['fix: correct behavior', '0.12.1'], ['feat: new capability', '0.13.0'], ['feat!: break interface', '1.0.0']]) {
    const f = fixture(t); f.change(message);
    assert.equal(f.plan().version, expected);
    assert.equal(JSON.parse(readFileSync(f.manifest)).version, expected);
  }
});

test('the workflow publishes annotated baseline and release tags, then excludes released changes', (t) => {
  const f = fixture(t); f.change('fix: correct behavior'); f.git('push', '-q', 'origin', 'main');
  const outputs = f.plan();
  const result = f.publish(outputs); assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git('cat-file', '-t', 'v0.12.0'), 'tag');
  assert.equal(f.git('cat-file', '-t', 'v0.12.1'), 'tag');
  assert.equal(f.git('rev-list', '-n', '1', 'v0.12.0'), f.boundary);
  const remote = f.git('ls-remote', '--tags', 'origin');
  assert.match(remote, /refs\/tags\/v0\.12\.0/); assert.match(remote, /refs\/tags\/v0\.12\.1/);
  assert.equal(f.git('rev-list', '-n', '1', 'v0.12.1'), f.git('rev-parse', 'HEAD'));
  f.change('docs: only presentation');
  const docs = f.plan(); assert.equal(docs.bumped, 'false'); assert.equal(docs.restore_base_tag, 'false');
  assert.equal(docs.version, '0.12.1');
  f.change('fix: another correction'); assert.equal(f.plan().version, '0.12.2');
  const tagBefore = f.git('rev-parse', 'v0.12.1');
  assert.notEqual(f.publish(outputs).status, 0, 'existing tags must not be overwritten');
  assert.equal(f.git('rev-parse', 'v0.12.1'), tagBefore);
});

test('documentation-only work can restore a missing tag without bumping or committing', (t) => {
  const f = fixture(t); const head = f.change('docs: only presentation'); f.git('push', '-q', 'origin', 'main');
  const outputs = f.plan(); const result = f.publish(outputs);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(JSON.parse(readFileSync(f.manifest)).version, '0.12.0');
  assert.match(f.git('ls-remote', '--tags', 'origin'), /refs\/tags\/v0\.12\.0/);
});

test('an advanced remote rejects both the release commit and tag publication atomically', (t) => {
  const f = fixture(t); f.change('fix: correction'); f.git('push', '-q', 'origin', 'main');
  const advanced = f.git('commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'concurrent change');
  f.git('push', '-q', 'origin', `${advanced}:main`);
  const result = f.publish(f.plan());
  assert.notEqual(result.status, 0);
  assert.equal(f.git('ls-remote', '--tags', 'origin'), '');
  assert.equal(f.git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], advanced);
});
