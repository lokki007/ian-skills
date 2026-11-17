# ian-skills

My best agent skills, cleaned up and open-sourced. Each one is a folder with a `SKILL.md`, and works with Claude Code, Codex and any agent that reads [Agent Skills](https://agentskills.io).

New skills land here regularly.

## The skills

| Skill | What it does | Needs |
|---|---|---|
| [**edge-research**](skills/edge-research) | Improve anything measurable without fooling yourself: freeze the eval, change one surface, measure, keep or revert. Routes to five specialists: [strategy](skills/edge-research-strategy) (prompts, copy, plans), [code](skills/edge-research-code) (code and UI), [system](skills/edge-research-system) (whole releases), [performance](skills/edge-research-performance) (speed and cost), [harvest](skills/edge-research-harvest) (prototypes with no baseline yet). | Python 3.9+ |
| [**keyword**](skills/keyword) | Keyword and market research around a topic or niche: free autocomplete harvest from six engines, clusters, questions, pains, then a visual HTML report. Optional paid enrichment adds volume, CPC and difficulty. | Node 18+; optional `DEEPAPI_API_KEY` |
| [**download**](skills/download) | Find, download, verify and file films, shows, music, videos or games into a tidy local library, with overwrite and identity safeguards. | `yt-dlp`, `curl`/`aria2c`, `ffprobe`; optional `rclone` |
| [**pareto-dev**](skills/pareto-dev) | 80/20 for software: rank diagnosis, audit and implementation options by impact, effort and risk, then ship the smallest change with evidence and regression tests. | — |
| [**pareto-general**](skills/pareto-general) | 80/20 for everything else: rank inputs and opportunities by real or estimated contribution, with the Pareto curve as a labelled estimate, not a law. | — |
| [**spielberg-for-suits**](skills/spielberg-for-suits) | Slick narrated motion-graphics explainer videos (1080p60 MP4) that sell an idea to leadership: HTML + GSAP scenes, TTS voice-over, generated music, mix, render, QA. | Node + Playwright, ffmpeg, Python; `OPENAI_API_KEY` for voice |

Each skill's `SKILL.md` lists its own setup and environment variables.

## Install

**Claude Code (plugin marketplace)**

```
/plugin marketplace add lokki007/ian-skills
/plugin install edge-research@ian-skills
```

Plugins: `edge-research`, `keyword`, `download`, `pareto`, `spielberg-for-suits`.

**Any agent (skills CLI)**

```
npx skills add lokki007/ian-skills
```

**By hand:** copy a folder from `skills/` into `~/.claude/skills/` (Claude Code) or `~/.agents/skills/` (Codex and others).

## Adding a skill (maintainers)

1. Copy the skill into `skills/<name>/`.
2. Strip anything personal: names, emails, absolute paths, hostnames, private projects and clients, keys. Credentials come from env vars only.
3. Frontmatter: `name`, `description`, `license: MIT`.
4. Run `bash scripts/check-private.sh`. It also reads a local, gitignored `.private-denylist` of private words (one regex per line).
5. Add a row to the table above and an entry in `.claude-plugin/marketplace.json`.

CI runs gitleaks, the generic privacy check, and syntax checks on every push.

## License

MIT, see [LICENSE](LICENSE). A few bundled third-party files keep their own licenses: GSAP in `spielberg-for-suits` ([notices](skills/spielberg-for-suits/THIRD_PARTY_NOTICES.md)) and the wordfreq data in `keyword` ([notice](skills/keyword/NOTICE.md)).
