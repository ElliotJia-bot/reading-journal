---
name: Quiet Folio
colors:
  surface: '#fdf9f3'
  surface-dim: '#ddd9d4'
  surface-bright: '#fdf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ee'
  surface-container: '#f2ede8'
  surface-container-high: '#ece7e2'
  surface-container-highest: '#e6e2dd'
  on-surface: '#1c1b19'
  on-surface-variant: '#414943'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f4f0eb'
  outline: '#717973'
  outline-variant: '#c0c9c1'
  surface-tint: '#3a674f'
  primary: '#14422d'
  on-primary: '#ffffff'
  primary-container: '#2d5a43'
  on-primary-container: '#9fcfb2'
  inverse-primary: '#a1d1b4'
  secondary: '#9c4328'
  on-secondary: '#ffffff'
  secondary-container: '#ff8f6e'
  on-secondary-container: '#76270e'
  tertiary: '#0b432c'
  on-tertiary: '#ffffff'
  tertiary-container: '#285b42'
  on-tertiary-container: '#9bd1b1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bceecf'
  primary-fixed-dim: '#a1d1b4'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#224f39'
  secondary-fixed: '#ffdbd1'
  secondary-fixed-dim: '#ffb59f'
  on-secondary-fixed: '#3a0a00'
  on-secondary-fixed-variant: '#7d2c13'
  tertiary-fixed: '#b8efce'
  tertiary-fixed-dim: '#9cd2b3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#1b5038'
  background: '#fdf9f3'
  on-background: '#1c1b19'
  surface-variant: '#e6e2dd'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Newsreader
    fontSize: 19px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  quote-editorial:
    fontFamily: Newsreader
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system embodies a calm, tactile literary sanctuary designed for avid readers, journalers, and thoughtful collectors tracking paperbacks, hardcovers, and e-readers. It prioritizes quiet focus over gamified noise, trading aggressive engagement mechanics for the timeless cadence of physical book design and private marginalia.

The visual direction balances refined editorial print craftsmanship with modern, warm-toned utility:
- **Atmospheric & Tactile**: Evokes archival book paper, warm linen bindings, and letterpress ink.
- **Reflective & Measured**: Generous breathing room, deliberate reading pace, and organic contrast create an unhurried, restorative digital experience.
- **Understated Precision**: Modern functional sans elements balance literary serif titles to anchor interactive habits, logs, and progress metrics with effortless clarity.

## Colors

The palette draws directly from bookbinding materials, botanical bookcloth, and sun-cured archival papers.

- **Primary (`#2D5A43`) & Primary Light (`#3B6E54`)**: Muted forest green representing quiet spaces, reading lamps, and clothbound editions. Used for core actions, active navigation states, reading milestones, and primary buttons.
- **Secondary (`#C86446`) & Secondary Accent (`#D97757`)**: Earthy terracotta used for bookmarks, streak highlights, status ribbons, finished badges, and literary quotations.
- **Neutral Core (`#242320`) & Neutral Subtle (`#3E3B36`)**: Deep charcoal inks offering maximum legibility without the stark harshness of pure black.
- **Background Surfaces**: Warm ivory canvas (`#FDFBF7`) for base screens paired with natural parchment (`#F7F3EB`) for elevated cards, shelves, and sheet containers. Surface strokes utilize muted warm ochre tints (`#E8E2D5`) to gently bound content.

## Typography

The typography couples the historic cadence of literature with crisp, accessible human-centered mobile utility.

- **Newsreader** handles book titles, author credits, major view headers, reading session logs, and pulled quotes. It lends the gravitas of a physically typeset volume. It should always maintain comfortable leading to preserve its literary rhythm.
- **Plus Jakarta Sans** governs functional interfaces, numerical reading stats (pages, percentages, timestamps), controls, search fields, and metadata tags. Its rounded geometric terminals soften technical data while preserving instant legibility.
- Italic variants of Newsreader are reserved specifically for reader notes, excerpt highlights, and dedicated quote moments.

## Layout & Spacing

The layout is built upon an adaptive 4-column structure on mobile devices, expanding to 8 columns on tablets and folded screens. The structure emphasizes comfortable margins reminiscent of wide book borders.

- **Canvas & Gutters**: Mobile layouts preserve a minimum `1.25rem` outer canvas padding to guard against edge crowding. A standard `0.75rem` column gutter keeps book grid covers neatly aligned.
- **Vertical Cadence**: Component stacks and reading journals rely on `space-md` (`1rem`) for associated grouped content, stepping up to `space-lg` (`1.5rem`) between editorial narrative sections and `space-xl` (`2.25rem`) between distinct modular blocks (e.g., Currently Reading showcase transitioning into Yearly Goal progress).
- **Touch Areas**: Interactive zones enforce a strict minimum touch target of 48×48px, padded internally to maintain visual delicacy while guaranteeing tactile ease.

## Elevation & Depth

Visual depth is achieved through delicate surface stacking and warm ambient shadows, avoiding sterile digital blurs and harsh artificial drop-shadows.

- **Base Canvas**: The foundation rest on warm ivory `#FDFBF7`.
- **Card Tier (Level 1)**: Raised surface cards sit on `#F7F3EB` bounded by a faint hairline stroke (`1px solid #E8E2D5`) combined with a soft, warm tinted ambient shadow: `0 2px 8px -2px rgba(62, 59, 54, 0.05)`.
- **Floating Overlays & Modals (Level 2)**: Bottom sheets, book shelf switchers, and quick-note sheets layer over the UI accompanied by a deeper ambient shadow: `0 12px 32px -4px rgba(36, 35, 32, 0.08)`.
- **Physical Book Elevation**: Rendered book jackets feature an organic micro-shadow along their right leaf edges: `2px 4px 12px rgba(36, 35, 32, 0.12)` mimicking bound spine thickness and resting weight.

## Shapes

The shape system leverages roundedness level 2 to deliver inviting, comfortable surfaces that echo rounded cloth book boards and softened corner bookmarks.

- **Base Radius (`0.5rem` / 8px)**: Applied to input elements, chips, segmented buttons, and badge pills.
- **Large Radius (`rounded-lg` - `1rem` / 16px)**: Standard curvature for book detail cards, journal log entries, and progress containers.
- **Extra Large Radius (`rounded-xl` - `1.5rem` / 24px)**: Applied to reading session sheets, bottom drawers, and modal sheets.
- **Book Cover Ratios**: Jacket cards maintain a fixed physical proportion (typically 1:1.5 or 2:3) with a subtle asymmetric spine treatment (flat left edge radius at 2px, softening outward to 6px on the outer right edges).

## Components

### Buttons
- **Primary**: Solid muted forest green (`#2D5A43`) background with parchment white text (`#FDFBF7`), `12px 20px` internal padding, height 48px, rounded to `0.5rem`. Smooth hover and tap states transition to `#3B6E54`.
- **Secondary / Ghost**: Transparent fill with a warm hairline border (`1.5px solid #E8E2D5`) and deep charcoal text (`#242320`).
- **Terracotta Accent**: Reserved for bookmark actions, reading sprint completions, and urgent prompts (`#C86446` background).

### Chips & Format Badges
- **Status & Device Tags**: Compact pills indicating reading format ("Kindle", "Physical Hardcover", "Apple Books", "Audiobook"). Styled with a soft parchment background (`#EFE9DD`), charcoal typography, and an icon indicator.
- **Active Filter Chips**: Solid forest green tint (`rgba(45, 90, 67, 0.12)`) paired with a `#2D5A43` stroke and label.

### Cards & Book Displays
- **Currently Reading Card**: Surfaces at `#F7F3EB` with `16px` (`rounded-lg`) corner radii. Features the book cover, a Newsreader headline, reading streak days in terracotta, and a thin forest green progress tracker line.
- **Note & Highlight Excerpt**: Block quotes rendered in italic Newsreader framed with a warm terracotta left border (`3px solid #C86446`), giving quotes an annotated notebook feel.

### Lists
- Grouped list rows separated by subtle `#EFE9DD` dividers. Generous item height (56px minimum) accommodating chapter summaries, reading logs, and timestamps.

### Inputs & Text Areas
- Warm off-white fill (`#FFFFFF` on `#F7F3EB` surfaces, or `#F7F3EB` on base ivory), outlined by `#E8E2D5`. Active focus highlights with a crisp `#2D5A43` border (2px) and no abrasive halo rings.

### Checkboxes & Progress Elements
- Custom rounded checkboxes with a forest green fill and parchment tick on selection. Progress bars utilize a muted sand rail (`#E8E2D5`) filled by the forest green indicator (`#2D5A43`) or terracotta on completion.