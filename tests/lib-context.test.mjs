import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseGh, parseGit, resolveDirectory, walkCommands } from '../scripts/lib/context.mjs';

const steps = (command, cwd = '/work/app') =>
  walkCommands(command, cwd).map(({ text, cwd: directory, branch }) => ({ text, cwd: directory, branch }));

test('walkCommands reports the directory each command runs in', () => {
  assert.deepEqual(steps('cd specs/x && touch spec.md; cd .. && ls'), [
    { text: 'cd specs/x', cwd: '/work/app', branch: undefined },
    { text: 'touch spec.md', cwd: '/work/app/specs/x', branch: undefined },
    { text: 'cd ..', cwd: '/work/app/specs/x', branch: undefined },
    { text: 'ls', cwd: '/work/app/specs', branch: undefined },
  ]);
});

test('walkCommands marks the directory unknown when cd cannot be resolved', () => {
  for (const command of ['cd "$DIR" && ls', 'cd ~other/src && ls', 'cd - && ls', 'cd && ls', 'popd; ls']) {
    assert.equal(walkCommands(command, '/work/app').at(-1).cwd, null, command);
  }
  assert.equal(walkCommands('cd "$DIR" && cd /srv/site && ls', '/work/app').at(-1).cwd, '/srv/site');
});

test('walkCommands expands a leading tilde to the home directory', () => {
  assert.equal(walkCommands('cd ~/src && ls', '/work/app').at(-1).cwd, join(homedir(), 'src'));
  assert.equal(walkCommands('cd ~ && ls', '/work/app').at(-1).cwd, homedir());
});

test('walkCommands keeps a branch switch made inside a subshell', () => {
  assert.equal(walkCommands('(cd sub && git switch main); git push', '/work/app').at(-1).branch, 'main');
});

test('walkCommands restores the directory when a subshell closes', () => {
  assert.equal(walkCommands('(cd sub && ls); pwd', '/work/app').at(-1).cwd, '/work/app');
  assert.equal(walkCommands('{ cd sub; ls; }; pwd', '/work/app').at(-1).cwd, '/work/app/sub');
});

test('walkCommands resolves Windows directories with Windows rules', () => {
  assert.equal(walkCommands('cd src && dir', 'C:\\work\\app').at(-1).cwd, 'C:\\work\\app\\src');
});

test('walkCommands reports the branch an earlier checkout or switch selected', () => {
  const last = (command) => walkCommands(command, '/work/app').at(-1);

  assert.equal(last('git switch main && git push').branch, 'main');
  assert.equal(last('git switch main && git push').branchCertain, true);
  assert.equal(last('git checkout -b feat/y origin/main && git push').branch, 'feat/y');
  assert.equal(last('git checkout --track origin/main && git push').branch, 'main');
  assert.equal(last('git switch --detach v1.0.0 && git push').branch, 'HEAD');
  assert.equal(last('git checkout main && git push').branch, 'main');
  assert.equal(last('git checkout main && git push').branchCertain, false);
});

test('walkCommands leaves the branch alone for path restores and other repositories', () => {
  const last = (command) => walkCommands(command, '/work/app').at(-1);

  assert.equal(last('git checkout main -- README.md && git push').branch, undefined);
  assert.equal(last('git checkout main README.md && git push').branch, undefined);
  assert.equal(last('git -C ../other checkout main && git push').branch, undefined);
});

test('walkCommands swaps back to the previous branch on a dash', () => {
  const last = (command) => walkCommands(command, '/work/app').at(-1);

  assert.equal(last('git switch main && git switch - && git push').branch, undefined);
  assert.equal(last('git switch a && git switch b && git switch - && git push').branch, 'a');
  assert.equal(last('git switch - && git push').branch, null);
});

test('walkCommands strips assignments and shell keywords before the command', () => {
  const [first, second] = walkCommands('if FOO=1 git status; then touch spec.md; fi', '/work/app');
  assert.deepEqual(first.tokens.map((token) => token.value), ['git', 'status']);
  assert.deepEqual(second.tokens.map((token) => token.value), ['touch', 'spec.md']);
});

test('parseGit finds the subcommand, its arguments, and -C directories', () => {
  assert.deepEqual(parseGit(['git', '-C', '/repo', '-c', 'a=b', 'push', '-u', 'origin', 'x']), {
    subcommand: 'push',
    args: ['-u', 'origin', 'x'],
    directories: ['/repo'],
  });
  assert.equal(parseGit(['/usr/bin/git', 'status']).subcommand, 'status');
  assert.equal(parseGit(['sudo', '-u', 'deploy', 'git', 'push']).subcommand, 'push');
});

test('parseGit and parseGh ignore a program named as an argument', () => {
  assert.equal(parseGit(['echo', 'git', 'push']), null);
  assert.equal(parseGit(['git']), null);
  assert.equal(parseGh(['echo', 'gh', 'pr', 'merge']), null);
});

test('parseGh separates subcommands from flags and skips the repository value', () => {
  assert.deepEqual(parseGh(['gh', '-R', 'o/r', 'pr', 'merge', '11', '--squash']), {
    subcommands: ['pr', 'merge', '11'],
    args: ['pr', 'merge', '11', '--squash'],
  });
});

test('resolveDirectory resolves in order and reports unknown as null', () => {
  assert.equal(resolveDirectory('/work/app', '../other'), '/work/other');
  assert.equal(resolveDirectory(null, 'sub'), null);
  assert.equal(resolveDirectory(null, '/srv/site', 'sub'), '/srv/site/sub');
});
