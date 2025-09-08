# 🐒 Userscripts by Tim Scharinger

My collection of Tampermonkey scripts.

## 📋 Table of Contents

- [🚀 Installation](#-installation)
- [🌟 Featured Scripts](#-featured-scripts)
  - [🔗 PR-2-Jira: GitHub Jira Link Creator](#-pr-2-jira-github-jira-link-creator)
    - [Features](#features)
    - [How it works](#how-it-works)
    - [Configuration](#configuration)
  - [🎨 Jira Epic Color Picker](#-jira-epic-color-picker)
  - [🛠️ Jira Board Utils](#️-jira-board-utils)
    - [Features](#features-1)
    - [How it works](#how-it-works-1)
- [💖 Support](#-support)

---

## 🚀 Installation

### 1. Install Tampermonkey

First, install the Tampermonkey browser extension:

- **Chrome/Edge**: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- **Safari**: [App Store](https://apps.apple.com/us/app/tampermonkey/id6738342400)

**Important:** For Safari users, you'll need to:
1. Enable Developer mode in Safari preferences
2. Allow user scripts in the Tampermonkey extension settings

### 2. Add Scripts

**Method 1: Import from URL (Recommended)**

1. Click on the script file in this repository (e.g., `pr-2-jira.js`)
2. Click the **"Raw"** button and copy the URL from your browser's address bar
3. Open Tampermonkey utilities: `chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils`
4. Paste the raw URL into **"Import from URL"** and click **"Install"**

**Method 2: Manual Copy/Paste**

1. Click on the script file in this repository (e.g., `pr-2-jira.js`)
2. Click the **"Raw"** button to view the raw script content
3. Copy the entire script content
4. Open Tampermonkey dashboard (click the Tampermonkey icon → Dashboard)
5. Click **"Create a new script"**
6. Replace the default template with the copied script content
7. Press **Ctrl+S** (or Cmd+S on Mac) to save

### 3. Configure Scripts

**For PR-2-Jira script:**
- The default prefix is `"Solves: Jira"`
- To customize, access settings through the Tampermonkey menu: **PR-2-Jira Settings**
- Configure which text patterns should trigger the button placement

---

## 🌟 Featured Scripts

### 🔗 PR-2-Jira: GitHub & Jira Integration

**Description:** A single userscript that seamlessly connects GitHub Pull Requests to Jira issues with smart button placement and automatic remote link creation.

### Features

- **Unified Script**: One installation handles both GitHub and Jira functionality automatically
- **Smart Button Placement**: Adds "📌 Create PR link in Jira" buttons next to Jira links that match your configured prefix (default: "Solves: Jira")
- **Domain Detection**: Automatically detects GitHub and Jira domains to provide the right functionality
- **Configurable Prefix**: Customize which text patterns trigger button placement through the settings menu
- **Automatic Link Creation**: Clicking the button opens the Jira issue and automatically creates a remote link back to the GitHub PR
- **Multiple Issue Support**: Handles PRs that reference multiple Jira issues correctly

### How it works

The script (`pr-2-jira.js`) automatically detects the page type and provides the appropriate functionality:

1. **On GitHub PRs**: Scans for Jira links with your configured prefix and adds buttons
   
   ![PR-2-Jira GitHub button](./docs/pr-2-jira-github.gif)
   _GitHub PR view showing the smart button placement next to Jira links_

2. **On Jira Issues**: Receives PR links and automatically creates remote links in the Jira issue
   
   ![PR-2-Jira Jira link created](./docs/pr-2-jira-jira.gif)
   _Jira issue automatically receiving the PR as a remote link (notification toast shows "link already exists" in this example)_

### Configuration

Access settings through by clicking the cogwheel icon. Located next to the "Create PR link in Jira" button or in the bottom left corner.

### 🎨 Jira Epic Color Picker

**Description:** Replaces Jira's fixed epic color options with a proper color picker, giving you full control over epic colors.

![Jira Epic Color Picker Screenshot](./docs/jira-epic-color-picker.png)

### 🛠️ Jira Board Utils

**Description:** Add custom project icons to Jira board cards based on configurable color rules. Perfect for visual project identification and team workflows.

![Jira Board Utils Screenshot](./docs/board-utils.png)

#### Features

- **Multi-Board Support**: Each board maintains its own independent configuration
- **Dynamic Color Rules**: Automatically fetches and displays your board's card color rules from Jira
- **Project-Based Images**: Simply enter a project key (e.g., "FTWEB") to use that project's avatar
- **Smart Configuration**: Choose which color rule triggers image placement with an intuitive interface
- **Automatic Refresh**: Settings are applied instantly without manual page reloads
- **User-Friendly Setup**: Toggle on/off per board with easy-to-use settings dialog

#### How it works

1. **Open Board Settings**: Click the "Board Utils" button in your Jira board toolbar
2. **Enable for Board**: Toggle on "Enable Board Utils for this board"
3. **Choose Color Rule**: Select which card color rule should trigger the image (e.g., `project = "FTWEB"`)
4. **Set Project Image**: Enter your project key (e.g., "FTWEB") to use that project's avatar, or provide a custom image URL
5. **Save & Enjoy**: Settings are saved automatically and applied to matching cards

#### Perfect for:
- **Project Identification**: Quickly identify which project each card belongs to
- **Team Workflows**: Visual indicators for different teams or components  
- **Multi-Project Boards**: Clear separation when working with multiple projects
- **Custom Branding**: Use project avatars or custom images for better visual organization

---

## 💖 Support

If this saves you clicks or makes Jira more pleasant:

- [☕ Buy me a coffee](https://ko-fi.com/scharinger)
- [⭐ Star this repository](https://github.com/scharinger/userscripts)
