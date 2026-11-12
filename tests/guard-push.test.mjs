import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decide } from '../scripts/guard-push.mjs';

test('decide blocks direct push to main', () => {
  const result = decide('git push origin main', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes directly to `main`/);
});

test('decide blocks direct push to master', () => {
  const result = decide('git push origin master', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes directly to `master`/);
});

test('decide blocks git push with --all', () => {
  const result = decide('git push origin --all', () => 'feat/my-branch');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /pushes every branch/);
});

test('decide allows pushing feature branches', () => {
  const result = decide('git push origin feat/my-branch', () => 'feat/my-branch');
  assert.equal(result.blocked, false);
});

test('decide blocks pushing current branch if current branch is main', () => {
  const result = decide('git push', () => 'main');
  assert.equal(result.blocked, true);
  assert.match(result.reason, /current branch, which is `main`/);
});

test('decide sees through git global flags that take a value', () => {
  // `-C` used to be swallowed by the generic "skip anything starting with -"
  // rule, so its *value* was read as the subcommand and the push sailed past.
  for (const command of [
    'git -C /repo push origin main',
    'git -c user.name=x push origin main',
    'git --git-dir=/r/.git push origin main',
    'git --work-tree /r push origin main',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, true, command);
  }
});

test('decide resolves HEAD to the branch it would actually write', () => {
  assert.equal(decide('git push origin HEAD', () => 'main').blocked, true);
  assert.equal(decide('git push origin @', () => 'master').blocked, true);
  assert.equal(decide('git push origin HEAD', () => 'feat/x').blocked, false);
});

test('decide is not fooled by a push mentioned inside a quoted string', () => {
  for (const command of [
    'echo "remember: git push origin main"',
    "git commit -m 'do not git push origin main'",
    'gh pr comment -b "git push origin main is forbidden"',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});

test('decide still allows the release flow it exists to protect', () => {
  assert.equal(decide('git push origin release/v1.2.0', () => 'release/v1.2.0').blocked, false);
  assert.equal(decide('git push -u origin hotfix/leak', () => 'hotfix/leak').blocked, false);
  assert.equal(decide('git push origin HEAD:release/v1.2.0', () => 'main').blocked, false);
});

test('decide blocks a protected branch anywhere in a chained command', () => {
  const result = decide('npm test && git push origin main', () => 'feat/x');
  assert.equal(result.blocked, true);
  assert.equal(result.reason.startsWith('`git push origin main`'), true);
});

test('decide asks rather than denies, so the user can still approve', () => {
  assert.equal(decide('git push origin main', () => 'feat/x').decision, 'ask');
});

test('decide catches merges, which never invoke git push at all', () => {
  // The hole this closes: an agent can branch, PR, wait for green CI, and
  // merge its own pull request without a single `git push` to a protected
  // branch.
  for (const command of [
    'gh pr merge 11 --squash',
    'gh pr merge --auto --squash',
    'gh pr merge',
    'gh api repos/o/r/pulls/11/merge -X PUT',
    'gh api --method PUT repos/o/r/pulls/11/merge',
    'gh api repos/o/r/merges -f base=main -f head=feat/x',
  ]) {
    const result = decide(command, () => 'feat/x');
    assert.equal(result.blocked, true, command);
    assert.equal(result.decision, 'ask', command);
    assert.match(result.reason, /Landing code is the human's decision/, command);
  }
});

test('decide catches a local merge while a protected branch is checked out', () => {
  assert.equal(decide('git merge feat/x', () => 'main').blocked, true);
  assert.equal(decide('git -C /repo merge feat/x', () => 'master').blocked, true);
  assert.equal(decide('git merge develop', () => 'feat/x').blocked, false);
});

test('decide leaves non-landing gh and git commands alone', () => {
  for (const command of [
    'gh pr create --base main',
    'gh pr view 11 --json mergeable,mergeStateStatus',
    'gh pr checks 11',
    'gh api repos/o/r/pulls/11',
    'git merge-base main HEAD',
    'echo "gh pr merge 11"',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});

test('decide sees git behind the prefixes that leave it in command position', () => {
  for (const prefix of [
    'sudo', 'sudo -u deploy', 'env GIT_TRACE=1', 'GIT_TRACE=1', 'command', 'exec', 'eval',
    'time', 'timeout 30', 'nohup', 'xargs', 'if', '!',
  ]) {
    const command = `${prefix} git push origin main`;
    assert.equal(decide(command, () => 'feat/x').blocked, true, command);
  }
});

test('decide ignores git and gh named as arguments to another command', () => {
  for (const command of [
    'echo git push origin main',
    'man git push',
    'grep -rn git push origin main',
    'echo gh pr merge 12',
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});

test('decide ignores a heredoc body that only mentions a push or merge', () => {
  for (const command of [
    'cat > NOTES.md <<EOF\nThen run git push origin main\nEOF',
    "cat <<'EOF' > NOTES.md\ngh pr merge 12\nEOF",
  ]) {
    assert.equal(decide(command, () => 'feat/x').blocked, false, command);
  }
});

test('decide still inspects a heredoc that is fed to a shell', () => {
  assert.equal(decide('bash <<EOF\ngit push origin main\nEOF', () => 'feat/x').blocked, true);
});

test('decide follows a branch switch made earlier in the same command line', () => {
  const merge = decide('git checkout main && git merge feat/x && git push', () => 'feat/x');
  assert.equal(merge.blocked, true);
  assert.match(merge.reason, /merges into `main`/);

  const push = decide('git switch main; git push', () => 'feat/x');
  assert.equal(push.blocked, true);
  assert.match(push.reason, /current branch, which is `main`/);

  assert.equal(decide('git checkout -b feat/y && git push', () => 'main').blocked, false);
  assert.equal(decide('git switch -c feat/y && git push -u origin HEAD', () => 'main').blocked, false);
});

test('decide does not mistake a path restore for a branch switch', () => {
  assert.equal(decide('git checkout main -- README.md && git push', () => 'feat/x').blocked, false);
  assert.equal(decide('git checkout main README.md && git push', () => 'feat/x').blocked, false);
  assert.equal(decide('git checkout . && git push', () => 'main').blocked, true);
  assert.equal(decide('git checkout README.md && git push', () => 'main').blocked, true);
});

test('decide returns to the starting branch on checkout -', () => {
  const command = 'git checkout main && git pull && git checkout - && git push';
  assert.equal(decide(command, () => 'feat/x').blocked, false);
});

test('decide resolves the branch in the directory the push runs in', () => {
  const branchIn = (directory) => ({ '/work/app': 'feat/x', '/work/other': 'main' })[directory];

  assert.equal(decide('cd ../other && git push', branchIn, '/work/app').blocked, true);
  assert.equal(decide('git -C ../app push', branchIn, '/work/other').blocked, false);
  assert.equal(decide('(cd ../other && git status); git push', branchIn, '/work/app').blocked, false);
  assert.equal(decide('(cd ../other && echo "done"); git push', branchIn, '/work/app').blocked, false);
});

test('decide falls back to the starting branch when it cannot follow the command line', () => {
  const branchIn = (directory) => ({ '/work/app': 'main' })[directory];
  for (const command of [
    'cd "$REPO" && git push',
    'cd "$(git rev-parse --show-toplevel)" && git push',
    'cd "$PWD" && git merge feat/x',
    'git -C "$REPO" push',
    'git switch - && git push',
  ]) {
    assert.equal(decide(command, branchIn, '/work/app').blocked, true, command);
  }
});

test('decide expands a home-relative cd before reading the branch there', () => {
  const home = homedir();
  const branchIn = (directory) => ({ [join(home, 'repo')]: 'main', '/work/app': 'feat/x' })[directory];
  assert.equal(decide('cd ~/repo && git push', branchIn, '/work/app').blocked, true);
});

test('decide keeps a branch switch made inside a subshell', () => {
  const command = '(git checkout main && git pull) && git push';
  assert.equal(decide(command, () => 'feat/x', '/work/app').blocked, true);
});

test('decide asks about the GitHub merge API only when the call writes', () => {
  assert.equal(decide('gh api repos/o/r/pulls/11/merge', () => 'feat/x').blocked, false);
  assert.equal(decide('gh api -X GET repos/o/r/pulls/11/merge', () => 'feat/x').blocked, false);
});

test('decide sees a merge behind the gh repository flag', () => {
  assert.equal(decide('gh -R o/r pr merge 11', () => 'feat/x').blocked, true);
  assert.equal(decide('gh --repo o/r pr merge 11', () => 'feat/x').blocked, true);
});

test('decide quotes only the start of a very long command', () => {
  const result = decide(`git push origin main ${'x'.repeat(5000)}`, () => 'feat/x');
  assert.equal(result.blocked, true);
  assert.ok(result.reason.length < 600, `reason is ${result.reason.length} characters`);
});

test('decide trusts a cd or a switch only as far as the joining operator shows it succeeded', () => {
  const branchIn = (directory) => ({ '/work/app': 'main', '/work/topic': 'feat/x' })[directory];
  const from = (command) => decide(command, branchIn, '/work/app').blocked;

  // `&&`, `;` and a newline reach an existing repository.
  assert.equal(from('cd /work/topic && git push'), false);
  assert.equal(from('cd /work/topic; git push'), false);
  assert.equal(from('cd /work/topic\ngit push'), false);
  assert.equal(from('cd /work/topic || exit 1; git push'), false);

  // The right side of `||` runs because the cd failed.
  assert.equal(from('cd /work/topic || git push'), true);
  // A cd in a pipeline or in the background runs in a subshell.
  assert.equal(from('cd /work/topic | git push'), true);
  assert.equal(from('cd /work/topic & git push'), true);
  // A directory with no repository is one the cd never reached.
  assert.equal(from('cd /work/missing; git push'), true);
  assert.equal(from('cd /work/missing && git push'), true);
});

test('decide lets a switch remove protection only after &&', () => {
  const onMain = (command) => decide(command, () => 'main').blocked;
  assert.equal(onMain('git switch -c feat/x && git push -u origin HEAD'), false);
  assert.equal(onMain('git switch feat/x; git push'), true);
  assert.equal(onMain('git switch feat/x || git push'), true);
  assert.equal(onMain('git switch feat/x | tail -1; git push'), true);

  // Towards more protection, an unconfirmed switch is still believed.
  const onTopic = (command) => decide(command, () => 'feat/x').blocked;
  assert.equal(onTopic('git switch main; git push'), true);
  assert.equal(onTopic('git switch main | tail -1; git push'), true);
});

test('decide finds git behind a program it does not know', () => {
  const onMain = (command) => decide(command, () => 'main').blocked;
  for (const command of [
    'flock /tmp/lock git push',
    'watch -n1 git push',
    'rtk git push',
    '>/dev/null FOO=1 git push',
    '\\git push',
  ]) {
    assert.equal(onMain(command), true, command);
  }
  for (const command of ['echo git push', 'grep -r git push docs', 'gh pr create --title git push']) {
    assert.equal(onMain(command), false, command);
  }
});

test('decide reads a heredoc that source or . executes', () => {
  const onMain = (command) => decide(command, () => 'main').blocked;
  assert.equal(onMain('source /dev/stdin <<EOF\ngit push\nEOF'), true);
  assert.equal(onMain('. /dev/stdin <<EOF\ngit push\nEOF'), true);
  assert.equal(onMain('cat <<EOF\ngit push\nEOF'), false);
});
