---
name: Rill
description: A living cartographic table for social strategy.
colors:
  river-teal: "#247a91"
  river-deep: "#18576a"
  ember-clay: "#d65f3d"
  pine-green: "#32765f"
  plum-crest: "#7c527f"
  field-gold: "#d99b37"
  map-parchment: "#f4ead2"
  cream-surface: "#fffaf0"
  walnut-ink: "#24352f"
  fog-text: "#6e7568"
typography:
  display:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "clamp(3.2rem, 6.2vw, 5.875rem)"
    fontWeight: 500
    lineHeight: 0.9
    letterSpacing: "-0.065em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  control: "11px"
  surface: "16px"
  feature: "24px"
spacing:
  hairline: "5px"
  control: "10px"
  surface: "18px"
  scene: "42px"
components:
  button-primary:
    backgroundColor: "{colors.walnut-ink}"
    textColor: "{colors.cream-surface}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  field:
    backgroundColor: "{colors.cream-surface}"
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
  table-panel:
    backgroundColor: "{colors.map-parchment}"
    textColor: "{colors.walnut-ink}"
    rounded: "{rounded.surface}"
    padding: "18px"
---

# Design System: Rill

## 1. Overview

**Creative North Star: "The Living Chart Table"**

Rill feels like friends leaning over a hand-inked coastal map under warm evening light. The board carries the full palette and ambient motion; the surrounding product interface stays quiet, legible, and spatially stable. Repeated controls are immediate. Rare events such as casting stones, raising structures, honor transfers, and victory earn richer choreography.

The system rejects borrowed tabletop trade dress, generic game dashboards, glass surfaces, identical card grids, and theatrical motion that delays a turn.

**Key Characteristics:**

- A luminous cartographic board set into a deep walnut evening table, with parchment reserved for decisions and the player hand.
- Restrained controls around a full-palette resource board.
- Tactile feedback under 250ms for repeated actions.
- Original layered SVG terrain and pieces with semantic interaction targets.
- Color-safe player crests, visible focus, sound-independent feedback, and reduced-motion equivalents.

## Active Game Experience

The play screen is organized by the questions a player asks in order:

1. **Whose move is it?** Opponent crests and the turn compass identify the current traveler, their human or wayfinder status, and whether they are actively choosing.
2. **What just happened?** Every atomic command produces a short, named activity banner. Dice receive a central result stage with real pips, a total, the actor, and the production consequence.
3. **What can I do now?** The parchment turn compass explains the current phase, shows cast/shape/pass progress, and owns all primary actions and costs.
4. **What do I have?** The bottom hand uses six tactile cards. Every resource has a unique silhouette, full name, count, and building uses; color is redundant reinforcement only.

Wayfinders execute one atomic decision per realtime tick. Their rolls, builds, trades, and handoffs must never collapse into an unexplained final state. The event stream is recovered over HTTP as well as WebSocket so local development and recycled server instances preserve the same live chronology.

## 2. Colors

The board owns saturation; navigation and controls use parchment, walnut, and fog so game state remains the loudest voice.

### Primary

- **River Teal**: Primary focus, current-flow emphasis, links, and selected actions.
- **River Deep**: High-contrast teal copy and quiet navigation emphasis.

### Secondary

- **Ember Clay**: Clay terrain, the ember player, and destructive warnings.
- **Field Gold**: Production warmth, probability emphasis, honors, and celebration.

### Tertiary

- **Pine Green**: Forest terrain and the pine player.
- **Plum Crest**: The fourth player identity; never a generic interface accent.

### Neutral

- **Map Parchment**: The reading and room background.
- **Cream Surface**: Input, toolbar, and high-clarity overlay surfaces.
- **Walnut Ink**: Primary text and confident actions.
- **Fog Text**: Secondary copy and metadata.

**The Board Owns Color Rule.** Saturated color belongs to terrain, pieces, resources, and current state. Inactive application chrome is quiet.

## 3. Typography

**Display Font:** Georgia (with Times New Roman fallback)
**Body Font:** Inter/system humanist sans stack

**Character:** The serif voice establishes a printed, storied place. The sans voice runs the game with compact, contemporary clarity.

### Hierarchy

- **Display** (500, fluid 51–94px, 0.9): Home and victory headlines only.
- **Headline** (500, 40–60px, 1): Room state and invitation scenes.
- **Title** (600, 12–29px): Players, panels, and action groups.
- **Body** (400, 14–18px, 1.6): Guidance and longer rules copy, capped near 70 characters.
- **Label** (750, 7–11px, 0.08em): Costs, counts, statuses, and controls.

**The Two Voices Rule.** Serif establishes place; sans runs the game. Display typography never appears on a repeated control.

## 4. Elevation

Rill is flat by default. Tonal layers separate map, sea, and interface; diffuse shadows appear only beneath tactile pieces, active panels, and lifted hover states.

### Shadow Vocabulary

- **Table lift** (`0 18px 60px rgba(29,43,38,.18)`): Modal and victory separation.
- **Piece contact** (`0 5px 3px rgba(0,0,0,.32)`): SVG structures and routes only.
- **Control response** (`0 5px 12px rgba(36,44,34,.12)`): Hovered action controls.

**The Table Surface Rule.** If three nested rectangles are visible, one container is unnecessary.

## 5. Components

### Buttons

- **Shape:** Tactile gently curved controls (9–13px radius).
- **Primary:** Walnut ink on cream with compact, confident padding.
- **Hover / Focus:** Lift 2px with a diffuse shadow; focus uses a 3px river-teal outline; active press scales to about 0.97.
- **Secondary:** Parchment or transparent surfaces with a one-pixel fog border.

### Cards / Containers

- **Corner Style:** Soft but not pill-shaped (12–18px).
- **Background:** Translucent parchment around the active table; opaque cream only when readability requires it.
- **Shadow Strategy:** Flat at rest, table lift for an active overlay.
- **Border:** One-pixel warm translucent line.
- **Internal Padding:** 8–18px according to density.

### Inputs / Fields

- **Style:** Cream surface, one-pixel fog border, 11–13px radius.
- **Focus:** River-teal border plus a restrained four-pixel wash.
- **Error / Disabled:** Clay-red text; disabled actions retain their label and drop to 38% opacity.

### Navigation

Navigation uses the serif Rill mark with quiet sans labels. The active-game toolbar is a compact parchment strip; the home scene keeps navigation visually open.

### Living SVG Board

Terrain, routes, ports, structures, probability marks, and the waystone are independent SVG layers. Illustrated terrain motifs, labeled ports, tactile structures, coast details, and a quiet compass make the board legible without borrowed artwork. Legal choices bloom with generous invisible geometry; ambient waves animate without React rerenders. Gameplay below 1024px is replaced by a composed desktop handoff.

### Resource Cards

Clay uses masonry, timber a tree, fleece a cloud-like flock, grain a sheaf, and stone a faceted rock. Each card always includes its written name and count. Compact build costs repeat the same silhouettes, so players can scan hand-to-action relationships without decoding a palette.

### Event & Dice Theater

The activity banner stays compact near the top of the board and names the actor and atomic result. A cast briefly earns the center: two high-contrast pip dice, their sum, and either production feedback or the waystone warning. The layer never captures pointer input and fades without delaying the next legal command.

## 6. Do's and Don'ts

### Do:

- **Do** let the shared SVG board dominate the active-game viewport.
- **Do** use 160–250ms motion to show origin, destination, ownership, and state change.
- **Do** pair every player color with a crest, name, and status.
- **Do** use original cartographic artwork, prose, synthesized audio, and iconography.
- **Do** preserve keyboard targets, visible focus, ARIA announcements, and reduced-motion behavior.

### Don't:

- **Don't** use official CATAN branding, artwork, trade dress, copy, iconography, or a visually confusing imitation.
- **Don't** create generic dark-mode game dashboards with neon accents and glass panels.
- **Don't** use identical card grids, nested containers, ornamental gradients, or oversized marketing metrics.
- **Don't** use theatrical motion that delays turns or makes repeated actions tiring.
- **Don't** squeeze active gameplay into a narrow mobile layout.
- **Don't** use gradient text, decorative glassmorphism, colored side-stripe borders, bounce easing, or `transition: all`.
