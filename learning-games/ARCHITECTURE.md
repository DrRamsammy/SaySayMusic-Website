# SaySayMusic Learning Games

Education Through Melody

## Purpose
A scalable multilingual learning-game platform designed to support 100,000+ source paragraphs and multiple reusable game engines without coupling game content to the existing music UI/API.

## Core architecture

### Subject tree
Categories use parent/child relationships rather than fixed levels. This supports unlimited depth.

Example:
Learning Games > Biology > Cell > Organelles > Cell Membrane

Example:
Learning Games > Anatomy & Physiology > Cardiovascular System > Heart > Chambers

### Languages
Every activity has one master identity and localized content for:
- English (en)
- Spanish (es)
- French (fr)

Additional languages can be added later without changing the game engine.

### Game engines
Game content is independent of game presentation. Initial engine:
- fill-build: read a passage and place selected words/phrases into blanks

Future engines may include diagram labeling, matching, sequencing, classification, multiple choice, and other formats.

### Storage plan
- GitHub: application and reusable game-engine code
- Cloudflare D1: categories, games, localized content, answer definitions, publication status, progress/scoring metadata
- Cloudflare R2: diagrams, images, audio, and other media
- Customer game application: games.saysaymusic.com
- Protected creator application: games-admin.saysaymusic.com

## Creator workflow
1. Select or retain a subject/category path.
2. Paste one paragraph or import a batch.
3. Select words/phrases manually or use automatic candidate selection.
4. Convert selections into blanks and answer-bank entries.
5. Generate Spanish and French drafts.
6. Validate/review localized content.
7. Preview.
8. Publish.

The creator must support Quick Create, Batch Create, and Mass Import workflows.

## First production activity
Biology > Cell > Organelles > Cell Membrane

Engine: fill-build

The original 2005 Cell Membrane activity will serve as the first master prototype.