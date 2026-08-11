# ZeroSpace launch drafts

These are tailored drafts, not a cross-posting instruction. Post one at a time, answer comments, and adapt the title to the community's current rules. ZeroSpace is free, local-first, open source, and read-only by default.

## 1. r/MacApps

**Title:** `[OS] ZeroSpace - free, local-first storage audit tool for Mac developers and agent workspaces`

**Body:**

I built ZeroSpace because agent-heavy development left my Mac full of checkpoints, model files, build output, installers, archives, caches, and abandoned experiments, and I wanted evidence before deleting anything.

It scans a chosen scope locally, shows likely reclaimable space, groups review candidates, verifies exact duplicates separately, and keeps cleanup review-first. Nothing is uploaded and nothing is deleted automatically.

Important caveat: this is currently a local developer utility, not a signed/notarized `.app` bundle. You run it from the official GitHub repo/Homebrew formula, it starts a localhost UI, and scans stay on your Mac.

Official source/download: https://github.com/LinusInnovator/zerospace

Transparency:

- I am the creator, so this is self-promotion.
- Pricing: free.
- License: MIT open source.
- Distribution: official GitHub repository only; no redirects, affiliates, referral links, or third-party download mirrors.
- AI disclosure: the scanner rules are deterministic and no cloud AI is required. I used AI-assisted coding while building the project.
- Relationship to other work: I am also building OmniCap, and may later use ideas from this there, but ZeroSpace is intended to stand alone as a free tool.

I would especially value feedback on first-run clarity, safety/trust, and whether the findings feel actionable before I make it more app-like.

## 2. r/LocalLLaMA

**Title:** I made a local disk-audit tool for the model/checkpoint debris that accumulates during agent work

**Body:**

If you run local models, ComfyUI/Stable Diffusion workflows, or coding agents, you probably have old checkpoints, safetensors, caches, LoRA/output folders, duplicate shards, and half-finished experiments spread across your Mac.

ZeroSpace is a free, local-only scanner that surfaces those files alongside ordinary clutter (downloads, installers, archives, media, large/stale files). It does not decide what to delete: every candidate has a path, size, category, reasons, and a review action. Duplicate grouping is kept separate from ordinary findings.

CLI example: `hd-detective scan ~/Models --json --fail-on duplicates`

Repo and feedback welcome: https://github.com/LinusInnovator/zerospace

## 3. r/macosprogramming

**Title:** Open-source macOS storage scanner with a read-only API and agent-friendly CLI — looking for implementation feedback

**Body:**

I’m sharing ZeroSpace as a small macOS/Python project for developers who want inspectable storage evidence rather than a “clean” button. The scanner validates scope, handles inaccessible files/symlinks defensively, streams progress, verifies duplicate groups, and exposes both a localhost UI/API and a stable CLI JSON contract.

The integration surface is intentionally boring: `hd-detective` still starts the server; `hd-detective scan PATH --json` is read-only and exits non-zero only when an opt-in `--fail-on` policy matches.

Code: https://github.com/LinusInnovator/zerospace

I’m most interested in review of the boundaries: macOS permissions, scan cancellation, path safety, and whether the API/CLI contract is useful for other tools.

Context: I am also building a larger app called OmniCap and may reuse parts of this idea later, but ZeroSpace is intentionally MIT-licensed and useful on its own.

## 4. r/SideProject

**Title:** I built the free local storage tool I wanted after agent projects filled my Mac with invisible debris

**Body:**

I built this because my own Mac kept accumulating files from agent-heavy work: cloned experiments, repeated dependencies, model/checkpoint files, build output, installers, archives, caches, downloads, and abandoned project folders.

The problem was not “I need a one-click cleaner.” It was “I need to understand what all this stuff is before I touch it.”

That became ZeroSpace: a free, local-first, review-first storage scanner for macOS. It scans a chosen scope, shows likely reclaimable space, explains why files are being surfaced, verifies exact duplicate groups separately, and does not upload anything or delete automatically.

It also has a scriptable CLI for people building with agents or automation:

`hd-detective scan PATH --json`

So you can use it in your own stack, CI, pre-PR checks, shell agents, or product experiments. The code is MIT licensed and provided as-is.

Repo: https://github.com/LinusInnovator/zerospace

I originally made it because I wanted the functionality myself, and I may later fold parts of the idea into my main app, OmniCap. But ZeroSpace is intended to stand alone as a useful free tool. I’d especially value feedback on first-run clarity, trust/safety, and whether the output feels actionable.

## 5. r/macOS Developer Saturday

**Title:** Developer Saturday: ZeroSpace, a free local-first storage audit tool for Mac developers and agents

**Body:**

Developer Saturday share: I made ZeroSpace to inspect the clutter produced by software work — model/checkpoint files, build output, caches, installers, archives, downloads, media, duplicates, and stale projects.

It is read-only by default, keeps results on the Mac, and gives a reasoned review list instead of silently removing files. Developers can also run `hd-detective scan PATH --json` in scripts or GitHub Actions.

Free/open source: https://github.com/LinusInnovator/zerospace

I’m the creator and this is self-promotion. I am also building a larger app called OmniCap and may reuse some of the thinking there later, but ZeroSpace is meant to be useful as a standalone free tool. Feedback on safety, speed, and whether the overview helps you decide is very welcome.

## Posting checklist

- Check the subreddit rules immediately before posting; policies and megathreads change.
- Use one community-specific post, not five identical links in a burst.
- Include the repository, license, pricing, and AI disclosure where requested.
- Say what feedback you want, then stay for the discussion.
- Never ask people to run a cleanup action blindly; the product is intentionally review-first.
