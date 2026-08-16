# Wrisp

**English** | [中文](README.zh-CN.md)

Wrisp is an **AI-native desktop app built specifically for Product Managers (PMs)**, powered by Electron + Vue 3 + TypeScript with a **Local-first** philosophy.

It was born out of a real struggle shared by an internet product manager: recording fragmented thoughts every day and regularly producing stage deliverables — yet never finding a tool that truly fits. Generic note-taking apps are too loose, while many "AI-does-it-for-you" tools go too far. Handing all your knowledge over to AI may seem effortless, but it leaves your knowledge sitting in the computer instead of taking root in your brain.

That's why Wrisp holds to one principle: **AI assists, never replaces**. AI handles understanding, linking, clustering, and retrieval, helping you distill fragmented inputs into a traceable knowledge base — but the processes of organizing, judging, and remembering always remain yours. When you write PRDs, competitive reports, or roadmaps, AI automatically recalls relevant material so every deliverable is grounded in evidence — and every retrieval doubles as an act of active recall.

If you share the same struggle, join us in shaping Wrisp into a knowledge workspace that truly works for people.

## ✨ Core Highlights

| Feature                        | Description                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block First**                | The smallest unit is not a document but a Block — capture fragments with zero organizing pressure                                                                                                 |
| **AI Assists, Never Replaces** | AI is deeply embedded in the workflow: it handles understanding, linking, clustering, and retrieval, while judgment and memory stay with you — knowledge enters your mind, not just your computer |
| **Local-first**                | Research data, competitive analyses, and unreleased roadmaps are stored entirely locally — privacy without compromise                                                                             |
| **Traceable Decisions**        | The rationale behind every requirement, every cut, and every decision is always one semantic link away                                                                                            |
| **Auto-crystallization**       | Fragments are automatically clustered into topics and grow into a knowledge system over time; report writing starts from assembly, not from scratch                                               |
| **Reflection Stream**          | Continuously surfaces requirement patterns and decision contradictions, serving as your "thinking companion"                                                                                      |

## 🎯 Target Users

**Purpose-built for Product Manager roles**, covering the following scenarios:

- **Product Manager (PM)**: requirement analysis, PRD writing, user research, competitive tracking
- **Product Owner (PO)**: release planning, roadmap building, prioritization decisions
- **Business Analyst**: requirement gathering, structured documentation, cross-team alignment
- **Founder / Decision-maker**: business requirement capture, decision-chain tracing, long-term thinking evolution

## 🚀 Core Features

### Journal — Daily Input

Capture fragmented requirements, competitive observations, meeting minutes, and data insights as Blocks with zero organizing cost.

### Wiki — Smart Organization

AI automatically builds semantic links, clusters topics, and visualizes concept networks, so fragmented knowledge organizes itself.

### Project — Structured Output

When writing PRDs, competitive reports, or roadmaps, AI recalls past material — start from assembly, not from scratch.

### Reflection — Continuous Insight

Automatically surfaces requirement patterns, decision contradictions, and data anomalies, becoming the PM's thinking companion.

## 📅 Roadmap

| Version                   | Goal                                             | Core Deliverables                                                                                         |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **V1 Journal Input**      | Content input & basic organization               | Block editing, PM input templates, decision blocks, @mentions, global search, calendar navigation         |
| **V2 Smart Organization** | AI auto-organization & knowledge crystallization | Concept networks, topic clustering, semantic links, cross-date relations, decision/action-item extraction |
| **V3 Output Scenarios**   | Structured output & deliverable production       | Project workspace, AI weekly report generation, inline AI chat, version upgrades                          |

## 🛠️ Tech Stack

- **Frontend**: Vue 3 + TypeScript + Composition API
- **Build tool**: Vite
- **Desktop framework**: Electron
- **State management**: Pinia
- **Routing**: Vue Router
- **UI components**: Naive UI
- **Editor**: Tiptap 3 (block editor)
- **Databases**: SQLite (better-sqlite3) + LanceDB (vector index)
- **AI gateway**: Multi-provider adapters (OpenAI/Claude/DeepSeek/Qwen/local models)
- **Code quality**: ESLint + TypeScript
- **Packaging**: electron-builder

## 🚀 Getting Started

### Download & Install

Download the installer for your platform from the [Releases page](https://github.com/liqms/wrisp/releases):

| Platform    | Installer                                    |
| ----------- | -------------------------------------------- |
| **Windows** | `.exe` (NSIS installer) or `.exe` (portable) |
| **macOS**   | `.dmg` or `.pkg`                             |
| **Linux**   | `.deb` / `.rpm` / `.AppImage`                |

Download and double-click to install.

### First Run

1. Launch the app and choose a data storage directory (defaults to your Documents folder)
2. Configure your AI model in Settings (OpenAI/Claude/DeepSeek/Qwen or a local model)
3. Open the Journal page and record your first requirement or idea

## 📄 License

### Personal Use

This project is open source under the [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE).
You are free to:

- ✅ Use it personally — for learning, research, and personal projects
- ✅ Share — copy and redistribute the work in any medium or format
- ✅ Modify — remix, transform, or build upon the work

Under the following terms:

- 📝 Attribution — you must give appropriate credit, provide a link to the license, and indicate whether changes were made
- 🚫 Non-commercial — you may not use the work for commercial purposes
- 🔄 Share-alike — if you remix, transform, or build upon the work, you must distribute your contributions under the same license

### Commercial License

If you wish to use this project for commercial purposes (including but not limited to):

- Offering paid services
- Integrating into a commercial product
- Operating as a SaaS service
- Any other profit-generating use
- Please contact the author to obtain a commercial license:

### Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability.

## 📞 Contact

- Project homepage: https://github.com/liqms/wrisp
- Issues: https://github.com/liqms/wrisp/issues
- Email: liqms@msn.cn

---

**Made with ❤️ for Product Managers**
