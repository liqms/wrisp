# Wrisp

**English** | [中文](README.zh-CN.md)

**An AI-native knowledge workspace for deep thinkers.**

Capture without friction. Recall automatically. Make every output traceable.

---

## Why Wrisp

We capture fragments every day: a piece of feedback in a meeting, an idea on the commute, a competitor's update. But when it's time to write a PRD or do a retrospective, that one key insight is often nowhere to be found.

Generic note-taking apps are too loose. AI-does-everything tools make you lose control over your own knowledge.

Wrisp holds one principle: **AI assists, never replaces.** AI handles understanding, linking, clustering, and recall. Judgment, organization, and memory always belong to you.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Block First** | The smallest unit is a Block, not a document. Zero-friction capture — hit enter and it's saved |
| **AI Assists, Never Replaces** | AI suggests links, clusters candidates, and recalls material. You confirm or reject. Knowledge enters your brain, not just your computer |
| **Local-first** | All data stays on your device. Unreleased research, roadmaps, and competitive analysis never leave your machine |
| **Traceable Decisions** | Every requirement, every cut, every trade-off — recall the reasoning behind it anytime through semantic links |
| **Automatic Crystallization** | Fragments automatically cluster into topics, accumulating into a knowledge system over time |
| **Reflection Feed** | Continuously surfaces thinking patterns and decision contradictions — a "second brain" for your thinking |

---

## Typical Scenarios

### Product Managers

- Hear a user insight in a meeting — hit enter, no need to decide which folder it goes in
- Writing a PRD? AI automatically recalls last month's research, competitive analysis, and user interviews
- Three months later, your boss asks "why did we cut this feature?" — one click recalls the original discussion and rationale

### Researchers / Analysts

- Jot down ideas while reading papers — AI automatically links them to existing notes
- Writing a report? Relevant material surfaces automatically, so you start from assembly, not from scratch

### Content Creators

- Fragments of inspiration automatically cluster into topics, ready to be called upon when writing
- Track the evolution of your thinking on a topic over time, forming a personal timeline of ideas

### Knowledge Workers

- Meeting notes, learning logs, project retrospectives — all captured in one place
- Semantic search recalls historical records in milliseconds when you need them

---

## Key Capabilities

### Journal — Frictionless Capture

Fragments, meeting notes, competitive observations, data insights — all captured as Blocks with zero organizational overhead. Supports Markdown syntax, `[[wiki links]]`, and `#tags`.

### Wiki — Intelligent Organization

AI automatically builds semantic links, clusters topics, and visualizes the concept network. Every AI suggestion can be confirmed, edited, or rejected by you.

### Project — Structured Output

When writing PRDs, reports, or articles, AI recalls historical material so you start from assembly, not from scratch. Supports Markdown export.

### Reflection — Insight Feed

Automatically surfaces thinking patterns, decision contradictions, and interest shifts as insight cards, helping you review your knowledge system more comprehensively.

---

## Quick Start

### Download

Go to the [Releases page](https://github.com/liqms/wrisp/releases) to download the installer for your platform:

| Platform | Package |
|----------|---------|
| **Windows** | `.exe` (NSIS installer) or `.exe` (portable) |
| **macOS** | `.dmg` or `.pkg` |
| **Linux** | `.deb` / `.rpm` / `.AppImage` |

Double-click to install and you're ready to go.

### First Use

1. Launch the app and choose a data storage directory (defaults to your Documents folder)
2. Configure your AI model in Settings (supports OpenAI / Claude / DeepSeek / Qwen / local models)
3. Go to the Journal page and start recording your first thought

---

## Roadmap

| Version | Goal | Key Deliverables |
|---------|------|------------------|
| **V1 Capture** | Content input and basic organization | Block editing, input templates, @mentions, global search, calendar navigation |
| **V2 Organize** | AI-powered organization and knowledge crystallization | Concept network, topic clustering, semantic links, cross-date associations, decision/action item extraction |
| **V3 Output** | Structured output and deliverable creation | Project workspace, AI weekly report generation, inline AI chat, version upgrade |

---

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Composition API
- **Build Tool**: Vite
- **Desktop Framework**: Electron
- **State Management**: Pinia
- **Router**: Vue Router
- **UI Components**: Naive UI
- **Editor**: Tiptap 3 (block editor)
- **Database**: SQLite (better-sqlite3) + LanceDB (vector index)
- **AI Gateway**: Multi-provider support (OpenAI / Claude / DeepSeek / Qwen / local models)
- **Code Standards**: ESLint + TypeScript
- **Packaging**: electron-builder

---

## License

### Personal Use

This project is open-sourced under the [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE).

You are free to:

- ✅ **Use** — for learning, research, and personal projects
- ✅ **Share** — copy and redistribute the material in any medium or format
- ✅ **Adapt** — remix, transform, and build upon the material

Under the following terms:

- 📝 **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- 🚫 **Non-Commercial** — You may not use the material for commercial purposes
- 🔄 **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original

### Commercial Licensing

If you wish to use this project for commercial purposes (including but not limited to):

- Offering paid services
- Integrating into commercial products
- Operating as a SaaS service
- Other for-profit uses

Please contact the author for commercial licensing.

### Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

---

## Contact

- Project Home: https://github.com/liqms/wrisp
- Issues: https://github.com/liqms/wrisp/issues
- Email: liqms@msn.com
