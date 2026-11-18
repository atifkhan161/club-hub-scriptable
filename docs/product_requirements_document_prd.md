# Product Requirements Document: Club Hub (Real Madrid Widget)

**Version:** 1.0
**Platform:** iOS / iPadOS / macOS (via Scriptable)
**Tech Stack:** JavaScript (ES6+), Scriptable API

## 1. Overview
**Club Hub** is a lightweight, customizable iOS/macOS home screen widget designed for Real Madrid fans. Built using the Scriptable app, it provides at-a-glance matchday information, including live or final scores, opponent details, team crests, and a visual representation of the club's recent form.

## 2. Objectives
* Provide a clean, distraction-free widget for Real Madrid match updates.
* Ensure a native-feeling UI that integrates seamlessly with iOS dark mode and the user's specific aesthetic (Omarchy OS style).
* Utilize asynchronous data fetching to keep match stats and images up to date without draining battery.

## 3. Target Audience
* Real Madrid supporters who want quick access to match data.
* iOS power users who prefer customizable widgets (via Scriptable) over standard App Store apps.

## 4. Core Features & Requirements

### 4.1. Matchday Scoreline
* **Team Identifiers:** Display standard 3-letter abbreviations (e.g., "RMA", "BAR") or full names depending on space.
* **Score Display:** Prominent, centered text showing the current or final score (e.g., "2 - 1").
* **Match Status:** Display the match time (e.g., "75'") or status (e.g., "FT", "HT") directly below the scoreline.

### 4.2. Dynamic Team Badges
* **Image Fetching:** The widget must asynchronously download and cache `.png` or `.svg` (if supported) crests for both Real Madrid and the opposing team.
* **Sizing:** Badges must be strictly constrained to `40x40` dimensions to prevent layout stretching.

### 4.3. Recent Form Indicator
* **Visual Blocks:** Display the results of the last 5 matches as small colored squares.
* **Color Coding:** 
  * Win (`W`): Green (`#2ecc71`)
  * Draw (`D`): Gray (`#95a5a6`)
  * Loss (`L`): Red (`#e74c3c`)
* **Layout:** Displayed horizontally at the bottom of the widget.

## 5. Technical Specifications

### 5.1. Data Source (API)
* The widget will rely on a 3rd-party REST API (e.g., API-Football, Sportmonks, or a custom backend) to fetch JSON data.
* **Required Data Points:**
  * Home Team Name/ID & Logo URL
  * Away Team Name/ID & Logo URL
  * Current Score (Home & Away)
  * Match Status (Time, Halftime, Fulltime)
  * Recent Form Array (e.g., `["W", "W", "D", "W", "L"]`)

### 5.2. Scriptable UI Architecture
* **Container:** `ListWidget` with padding set to `(15, 15, 15, 15)`.
* **Layout Management:** Nested `WidgetStack` elements (combining horizontal and vertical layouts).
* **Execution:** Handled natively by iOS widget lifecycle via Scriptable.

## 6. Design & UX
* **Theme:** Enforced Dark Mode.
* **Background:** Solid dark hex (e.g., `#1a1a1a`).
* **Typography:** System fonts, utilizing `Font.boldSystemFont` for scores and `Font.semiboldSystemFont` for labels.
* **Accent Colors:** Gold (`#f1d382`) used for specific highlights like Match Status, nodding to the club's aesthetic.

## 7. Testing & Deployment
* **Local Testing:** Development and pixel-perfect visual debugging will be conducted using the native macOS Scriptable application on Apple Silicon.
* **Deployment:** Users will copy the `.js` script into their iCloud Drive Scriptable folder or paste it directly into the Scriptable app on iOS.

## 8. Future Considerations (Out of Scope for V1)
* Integration of RSS feeds (e.g., Managing Madrid articles).
* Tap-to-open functionality linking to specific match highlights or news apps.
* Lock Screen widget variations (circular and rectangular).