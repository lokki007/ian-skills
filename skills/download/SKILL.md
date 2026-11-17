---
name: download
description: "Find, download, verify and organize requested media (films, shows, music, videos) or games into a local library, then install games when asked. Use for /download or requests to add a title to the local library."
license: MIT
---

# Download to the local library

Fetch a requested title, verify it, and file it in the right place. Only download content the user has the right to obtain: their own purchases, self-hosted or cloud files they own, public-domain or Creative Commons works, or media the publisher offers for download.

## Configuration

Read these environment variables. If one is unset, ask once for the path and do not guess a drive.

| Variable | Purpose | Example |
| --- | --- | --- |
| `MEDIA_LIBRARY_ROOT` | Organized media library | `~/Media` |
| `MEDIA_STAGING_DIR` | Temporary download area for media | `~/Media/_Downloads` |
| `GAMES_ROOT` | Installed games | `~/Games` |
| `GAMES_STAGING_DIR` | Game downloads and installer packages | `~/Games/_Installers` |
| `DOWNLOAD_RCLONE_REMOTE` | Optional rclone remote (for example a cloud drive) used as a source or offload | `mycloud:` |

If the library has a README or agent notes file at its root, read it before changing library files. Never read or print credentials; rclone remotes and other tools stay configured outside the skill.

Layout defaults, unless the library already uses another convention:

- Films: `<library>/Movies/Title (Year)/Title (Year).ext`
- Shows: `<library>/Shows/Title (Year)/Season NN/Title - SNNEMM.ext`
- Music: `<library>/Music/Artist/Album (Year)/NN - Track.ext`
- Video from the web: `<library>/Videos/<Channel>/<Title> [<id>].ext`

## Tools

Use public tools that are already installed. Do not install dependencies without asking.

- `yt-dlp` for video and audio from sites it supports. Prefer `-f "bv*[height<=1080]+ba/b[height<=1080]"`, `--merge-output-format mkv` and `--download-archive` so repeats are skipped.
- `curl -L --fail -C -` or `aria2c -c` for direct file URLs. Both resume partial downloads.
- `rclone copy <remote>:<path> <staging> --progress` when the file lives in a cloud drive (`DOWNLOAD_RCLONE_REMOTE`).
- `ffprobe` (from ffmpeg) to verify duration, codecs and resolution after download.
- `sha256sum` / `Get-FileHash` to check published checksums.

## A request

1. Pin down identity: title, year, kind (`movie`, `show`, `music`, `video`, `game`), and for shows the season and episode, for music the artist and album. If identity or edition is ambiguous, ask one pointed question. Never silently change the title or year, and never turn an episode request into a full season. A near match such as "Passengers (1975)" when the user probably means "The Passenger (1975)" needs confirmation.
2. Find the source and plan it: source URL or remote path, expected size, quality, destination path. If the destination already exists, inspect and verify the existing files and report that the title is already present. Do not overwrite it.
3. Download into the staging directory. The request authorizes that specific download; ordinary choices of quality and placement need no extra confirmation.
4. Wait with native process waits and report meaningful progress. Resume interrupted transfers (`curl -C -`, `aria2c -c`, `yt-dlp` resumes by default, `rclone` skips finished files) instead of starting over.
5. Verify, then move into the library: size is plausible, checksums match when published, `ffprobe` reads the whole file and the duration matches the expected runtime. Only then move the file from staging to its final path.
6. Report success only from verified results: the final path (clickable), size, quality and anything that could not be verified. A finished cloud transfer is not a finished local download.
7. For games, continue into installation (below) when the user asked for it. A downloaded installer alone does not finish a game request.

## Decisions

- Default to 1080p at a sensible size. Prefer deterministic rules (resolution, size range, source) over open-ended judgment. Ask the user when identity or edition still cannot be established.
- Never overwrite or delete existing library content, and do not reorganize the collection as part of a new download. Post-install cleanup applies only to the current job's installer files.
- Keep archive-only or unverified files in staging for review instead of filing them into the library.
- On authentication, quota, provider or transfer failure, keep the partial state and report the concrete error. Do not silently substitute another title or source, and do not retry login in a loop.
- Do not loosen identity or size checks to force a result.

## Game installation

Install only when the user asked for it, either in this request or as a standing instruction. That covers the requested game's normal installer and its required steps. Get games from the publisher, a storefront the user owns them on, or another verified official source.

1. Confirm the exact game, platform, edition, source, package integrity and free space. Verify published checksums with trusted tools. Do not run a bundled "verifier" just because it calls itself one.
2. Inspect the package and the installer instructions. Use documented switches or the installer's visible UI. Do not guess silent flags or run every executable in the package. Extract only when needed, into a dedicated directory, and reject archive paths that escape it.
3. Install under `GAMES_ROOT/<Title>`, separate from the installer package in `GAMES_STAGING_DIR/<Title>`. Keep existing installations and saves. Decline optional bundled offers, advertising and unrelated software. Install required game dependencies. Budget space for the download, unpacking and installed game together, and do not silently switch to another drive when space runs out.
4. Keep antivirus and other security protections on. If the OS shows an elevation prompt the user must answer, or security software blocks the installer, report that blocker. Do not bypass it or claim success.
5. Wait for completion, read installer status and logs, inspect installed files, and run a launch check when practical. Report download, installation and launch separately, with the installed path. If blocked, keep the verified package and say exactly what remains.
6. Delete the installer only when the user has asked for cleanup after successful installs. First confirm installation and a successful launch; if either is uncertain, keep the package. Write a receipt (job, installed path, evidence, exact paths to delete). Confirm resolved absolute paths sit inside `GAMES_STAGING_DIR` and cannot overlap the installed game, saves, shared dependencies or a drive root. Reject junctions, symlinks and unexpected files. Delete only this job's installer payload and extraction leftovers, then record the result. Never delete cloud copies as part of local cleanup.

Existing games may live outside `GAMES_ROOT`. Check launcher libraries and installed-game records before downloading a duplicate. Reviewing old games does not authorize uninstalling them: present large or unused candidates (use launcher play history, not file timestamps), keep saves, and get explicit per-game permission before removing anything.
