# DailyFocus

DailyFocus is a minimalistic daily journal and TODO tracker designed to help you build consistent habits without leaving your browser. All notes and tasks stay on your device thanks to `localStorage` persistence—no passphrases or accounts required.

## Features

- "What I did today" journal entries with editable dates, link/photo attachments, and gentle auto-save feedback.
- Unlimited days with up to 50 notes per day, keyboard-friendly quick add shortcuts, and inline editing.
- TODO tracker with creation timestamps, optional deadlines, completion toggles, and deletion controls.
- Automatic dark/light theme detection with manual toggle and persistent preference.
- Quick JSON export plus import for moving data between devices without a server.
- Responsive, minimalist UI with subtle animations and motivational messaging.

## Getting Started

### Prerequisites

You only need a modern web browser. No build step or backend is required.

### Run locally

1. Clone this repository or download the source files.
2. Open `index.html` in your browser.
3. Start adding notes (`Ctrl + Enter`) and todos (`Alt + Enter`). All changes are saved automatically.

### Deploy to GitHub Pages

1. Fork this repository on GitHub.
2. Visit **Settings → Pages** and select the `main` branch with the root (`/`) folder.
3. Save; GitHub Pages will provide a public URL once the site is built.
4. Future updates only require pushing to the default branch.

## Data export & backup

Use the **Export data** button at the bottom of the interface to download `daily_summary_YYYY-MM-DD.json`. This file contains your journal, TODOs, and attachments for safe keeping or import elsewhere. To restore or move your data, choose **Import data** and select a previously exported JSON file.

## Customisation tips

- Edit `styles.css` to adjust colors, spacing, or typography.
- Tweak `script.js` inline comments to modify shortcuts, storage keys, or add more sections.

## Security & privacy

All data is stored in your browser's `localStorage` and never sent to external servers. For stronger protection consider using a browser-level password manager or OS account security.

Enjoy staying consistent today! 💪
