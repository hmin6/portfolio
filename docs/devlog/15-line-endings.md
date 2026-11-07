# #15 Standardize line endings with .gitattributes
Date: 2026-11-07
PR: #34

## What I did
Added a `.gitattributes` file so every text file uses LF line endings on every machine and in CI, plus a one-line VS Code setting so new files are created with LF:
- **`* text=auto eol=lf`:** Git decides which files are text, stores them with LF, and checks them out with LF, whatever each machine's `core.autocrlf` says.
- **Exceptions:** `.bat` and `.cmd` keep CRLF so future Windows scripts still run. `package-lock.json` is text with LF and collapsed in GitHub PR diffs. Images, PDFs, fonts, audio and video are marked `binary`.
- **SVGs stay text.** They're XML, so diffs stay readable.
- **`.vscode/settings.json`:** `"files.eol": "\n"`.

I ran `git add --renormalize .` as the issue asked. It found nothing to change.

## Why
Git on Windows kept warning "LF will be replaced by CRLF" when I staged files. I work on two computers, and CI runs on Linux, so line endings should be the same everywhere instead of depending on each machine's Git settings.

## How it works
- **Where the warning came from.** Git for Windows sets `core.autocrlf=true` in its system config (`C:/Program Files/Git/etc/gitconfig`). The repo already stored LF, but my working copy was checked out as CRLF, and Git warned whenever it saw an LF file it would later rewrite. `git ls-files --eol` showed it: 61 files were `i/lf w/crlf` (LF in the repo, CRLF on disk).
- **Why `.gitattributes` fixes it.** Attributes are committed with the repo, so they apply to every clone. `eol=lf` overrides `core.autocrlf` for this repo only, and nothing in the global Git config had to change.
- **Proving renormalize changed nothing.** `git diff --cached --stat` and `git diff --cached --ignore-cr-at-eol --stat` were both empty. The second would list any file whose content changed apart from line endings.
- **Proving the fix works.** A fresh clone of the branch on the same Windows machine, with `autocrlf=true` still set, showed all 63 text files as `i/lf w/lf`, and `git add` after an edit printed no warning.
- **Why the VS Code setting.** On Windows, VS Code creates new files with CRLF. Git would convert them to LF on commit, but it would warn the other way ("CRLF will be replaced by LF"). I confirmed that with a test file saved with CRLF.
- **Existing working copies.** Adding `.gitattributes` doesn't rewrite files already on disk, so each computer needed a one-time refresh: `git rm -r --cached -q .`, then `git reset --hard HEAD`. I did it on the branch before merging, on both my desktop and my laptop. Afterward `git ls-files --eol | Select-String "w/crlf"` printed nothing, `git add` on an edited file showed no warning, and VS Code's status bar showed LF. After merging, each computer only needs `git switch main`, `git pull`, and `git branch -d 15-line-endings`.

## Problems I hit
- **Renormalizing changed nothing.** I expected `git add --renormalize .` to rewrite files, but the repo already stored LF. The CRLF only ever existed in my working copy. So there's no renormalize commit, and the PR shows the empty check instead.
- **`gh issue view` printed nothing** in Claude's shell even though it succeeded. `gh issue view 15 --json title,body,comments` worked.
- **Refreshing the working copy was blocked** for Claude because `git reset --hard` can discard work. Claude checked the result in a separate clone instead, and I ran the refresh myself on both computers.

## What I learned
- **The warnings came from conversion, not the repo.** The repo already stored every
  text file with LF. Git for Windows sets `core.autocrlf=true`, so it converted files to
  CRLF on checkout and back to LF on commit. The "LF will be replaced by CRLF" warning
  appeared when I staged a file a tool had saved with LF, because Git would rewrite it
  as CRLF the next time it checked it out.
- **`.gitattributes` makes the rule part of the repo.** `* text=auto eol=lf` overrides
  each computer's `core.autocrlf` for this project, so both of my machines behave the
  same without changing any global settings. SVGs stay text because they're XML; images,
  fonts, and PDFs are marked binary so Git never converts or merges them.
- **Prove a no-op instead of assuming it.** `git add --renormalize .` staged nothing,
  and `git diff --cached --stat` was empty, so the repo needed no changes, not even line
  endings. The `--ignore-cr-at-eol` check was there to catch content changes if
  renormalizing had staged anything. An empty result is still a result worth recording.
- **`git ls-files --eol` shows both sides.** `i/` is how a file is stored in the repo and
  `w/` is how it sits on my disk, which made it clear the problem was only in my working
  copy.
- **Git only rewrites files when it checks them out.** Removing everything from the index
  with `git rm -r --cached` and then running `git reset --hard HEAD` forced a fresh
  checkout under the new rules. `git reset --hard` discards uncommitted changes, so
  `git status` has to be clean first; untracked files, like my devlog draft, are left
  alone. Claude Code's auto mode refused to run it for me, which is the right call for a
  command that can lose work.
- **Test on the branch before merging.** Refreshing both computers on the PR's branch
  tested the exact change and let me finish the devlog before merging, instead of
  needing a follow-up PR.
- **Editors need the same rule.** VS Code on Windows creates new files with CRLF by
  default, so `.vscode/settings.json` sets `"files.eol": "\n"` to match.
