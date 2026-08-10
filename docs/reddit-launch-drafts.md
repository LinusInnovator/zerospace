# ZeroSpace launch drafts

These are tailored drafts, not a cross-posting instruction. Post one at a time, answer comments, and adapt the title to the community's current rules. ZeroSpace is free, local-first, open source, and read-only by default.

## 1. r/MacApps

**Title:** `[OS] ZeroSpace — a free, local-first way to find storage clutter and agent-workspace debris`

**Body:**

I built ZeroSpace because agent-heavy development left my Mac full of checkpoints, model files, build output, installers, archives, caches, and abandoned experiments — and I wanted evidence before deleting anything.

It scans a chosen scope locally, groups likely clutter into review stories, verifies duplicates separately, and keeps cleanup review-first. Nothing is uploaded and nothing is deleted automatically. There is also a scriptable `hd-detective scan PATH --json` command for agent/CI workflows.

Free and open source: https://github.com/LinusInnovator/zerospace

**Pricing:** free. **AI disclosure:** the rules are deterministic; no cloud AI is required. I would especially value feedback on first-run clarity and whether the findings feel trustworthy.

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

## 4. r/SideProject

**Title:** I built the free storage tool I wanted after my agent projects filled my Mac with invisible debris

**Body:**

The problem was not “I need a one-click cleaner.” It was “I need to understand what all these files are before I touch them.”

That became ZeroSpace: a local-first, review-first storage scanner that finds large/stale files, duplicate groups, downloads, installers, media, caches, model artifacts, build output, and abandoned project folders. It is free, open source, and also usable from scripts/CI with a JSON scan command.

Try it or tell me where the UX is confusing: https://github.com/LinusInnovator/zerospace

I’m building a larger app (OmniCap); this is a deliberately useful standalone tool and a way to learn in public. Honest criticism is more useful than compliments.

## 5. r/macOS Developer Saturday

**Title:** Developer Saturday: ZeroSpace, a free local-first storage audit tool for Mac developers and agents

**Body:**

Developer Saturday share: I made ZeroSpace to inspect the clutter produced by software work — model/checkpoint files, build output, caches, installers, archives, downloads, media, duplicates, and stale projects.

It is read-only by default, keeps results on the Mac, and gives a reasoned review list instead of silently removing files. Developers can also run `hd-detective scan PATH --json` in scripts or GitHub Actions.

Free/open source: https://github.com/LinusInnovator/zerospace

I’m the creator and this is self-promotion. Feedback on safety, speed, and whether the overview helps you decide is very welcome.

## Posting checklist

- Check the subreddit rules immediately before posting; policies and megathreads change.
- Use one community-specific post, not five identical links in a burst.
- Include the repository, license, pricing, and AI disclosure where requested.
- Say what feedback you want, then stay for the discussion.
- Never ask people to run a cleanup action blindly; the product is intentionally review-first.
