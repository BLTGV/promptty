# Promptty Color System

## Brand Colors

### Primary: Navy (Slate)
Based on Tailwind's slate palette, anchored on #0f172a

| Name | Hex | Usage |
|------|-----|-------|
| Navy 950 | #020617 | Darkest (not used) |
| Navy 900 | #0f172a | Dark mode page background |
| Navy 800 | #1e293b | Dark mode nav/sidebar/cards |
| Navy 700 | #334155 | Dark mode borders, code bg |
| Navy 600 | #475569 | Dark mode muted text |
| Navy 500 | #64748b | Medium gray |
| Navy 400 | #94a3b8 | Light mode muted text |
| Navy 300 | #cbd5e1 | Dark mode body text |
| Navy 200 | #e2e8f0 | Dark mode headings |
| Navy 100 | #f1f5f9 | Light mode cards |
| Navy 50  | #f8fafc | Light mode nav/sidebar |

### Accent: Emerald
Based on Tailwind's emerald palette

| Name | Hex | Usage |
|------|-----|-------|
| Emerald 900 | #064e3b | Dark accent bg (dark mode) |
| Emerald 800 | #065f46 | Dark accent |
| Emerald 700 | #047857 | |
| Emerald 600 | #059669 | Links (light mode) |
| Emerald 500 | #10b981 | Primary accent color |
| Emerald 400 | #34d399 | Links (dark mode), hover states |
| Emerald 300 | #6ee7b7 | Light accent |
| Emerald 200 | #a7f3d0 | Light accent bg (light mode) |

---

## Starlight Variable Mapping

### Understanding Starlight's Inversion Pattern

Starlight uses semantic brightness naming:
- `--sl-color-white` = "bright" color (light in dark mode, dark in light mode)
- `--sl-color-black` = "page background" color (dark in dark mode, light in light mode)
- Gray scale follows this pattern: gray-1 is nearest to white, gray-6 is nearest to black

### Dark Mode Variables

```css
:root {
  /* Page background */
  --sl-color-black: #0f172a;      /* Navy 900 - main bg */

  /* Bright text/elements */
  --sl-color-white: #f1f5f9;      /* Navy 100 - titles, bright text */

  /* Gray scale (light → dark in dark mode) */
  --sl-color-gray-1: #e2e8f0;     /* Navy 200 - lightest gray */
  --sl-color-gray-2: #cbd5e1;     /* Navy 300 - body text */
  --sl-color-gray-3: #94a3b8;     /* Navy 400 - muted text */
  --sl-color-gray-4: #64748b;     /* Navy 500 - disabled */
  --sl-color-gray-5: #475569;     /* Navy 600 - subtle borders */
  --sl-color-gray-6: #1e293b;     /* Navy 800 - nav/sidebar bg */

  /* Backgrounds */
  --sl-color-bg: #0f172a;         /* Navy 900 */
  --sl-color-bg-nav: #1e293b;     /* Navy 800 */
  --sl-color-bg-sidebar: #1e293b; /* Navy 800 */
  --sl-color-bg-inline-code: #334155; /* Navy 700 */

  /* Borders */
  --sl-color-hairline-light: #334155; /* Navy 700 */
  --sl-color-hairline: #475569;       /* Navy 600 */

  /* Accent (Emerald) */
  --sl-color-accent-low: #064e3b;     /* Emerald 900 */
  --sl-color-accent: #10b981;         /* Emerald 500 */
  --sl-color-accent-high: #34d399;    /* Emerald 400 */

  /* Text */
  --sl-color-text: #cbd5e1;           /* Navy 300 */
  --sl-color-text-accent: #34d399;    /* Emerald 400 */
}
```

### Light Mode Variables

```css
:root[data-theme='light'] {
  /* Page background */
  --sl-color-black: #ffffff;      /* Pure white - main bg */

  /* Dark text/elements */
  --sl-color-white: #0f172a;      /* Navy 900 - titles, dark text */

  /* Gray scale (dark → light in light mode) */
  --sl-color-gray-1: #1e293b;     /* Navy 800 - darkest gray */
  --sl-color-gray-2: #334155;     /* Navy 700 - body text */
  --sl-color-gray-3: #475569;     /* Navy 600 - muted text */
  --sl-color-gray-4: #64748b;     /* Navy 500 - disabled */
  --sl-color-gray-5: #94a3b8;     /* Navy 400 - subtle borders */
  --sl-color-gray-6: #f1f5f9;     /* Navy 100 - nav/sidebar bg */
  --sl-color-gray-7: #f8fafc;     /* Navy 50 - page bg alternate */

  /* Backgrounds */
  --sl-color-bg: #ffffff;         /* White */
  --sl-color-bg-nav: #f8fafc;     /* Navy 50 */
  --sl-color-bg-sidebar: #f8fafc; /* Navy 50 */
  --sl-color-bg-inline-code: #f1f5f9; /* Navy 100 */

  /* Borders */
  --sl-color-hairline-light: #e2e8f0; /* Navy 200 */
  --sl-color-hairline: #cbd5e1;       /* Navy 300 */

  /* Accent (Emerald) */
  --sl-color-accent-low: #a7f3d0;     /* Emerald 200 */
  --sl-color-accent: #10b981;         /* Emerald 500 */
  --sl-color-accent-high: #059669;    /* Emerald 600 */

  /* Text */
  --sl-color-text: #334155;           /* Navy 700 */
  --sl-color-text-accent: #059669;    /* Emerald 600 */
}
```

---

## Component Color Usage

### Cards
- Background: `--sl-color-black` (dark: Navy 800, light: Navy 100)
- Title: `--sl-color-white` (dark: Navy 100, light: Navy 900)
- Body: `--sl-color-gray-2` (dark: Navy 300, light: Navy 700)

### Navigation
- Background: `--sl-color-bg-nav`
- Text: `--sl-color-gray-2`
- Active: `--sl-color-accent`

### Sidebar
- Background: `--sl-color-bg-sidebar`
- Text: `--sl-color-gray-3`
- Active: `--sl-color-accent` with `--sl-color-accent-low` bg
- Hover: `--sl-color-gray-2`

### Buttons (Primary)
- Background: `--sl-color-accent`
- Text: `--sl-color-black` (dark) / white (light)
- Hover: `--sl-color-accent-high`

### Code Blocks
- Background: `--sl-color-gray-6` (dark: Navy 800, light: Navy 100)
- Text: `--sl-color-gray-2`

### Links
- Color: `--sl-color-text-accent`
- Hover: `--sl-color-accent-high`

---

## Contrast Requirements (WCAG AA)

| Element | Foreground | Background | Ratio Required |
|---------|------------|------------|----------------|
| Body text | 4.5:1 | Page bg | AA |
| Large text | 3:1 | Page bg | AA |
| UI components | 3:1 | Adjacent | AA |

### Dark Mode Contrast Checks
- Body text (#cbd5e1) on bg (#0f172a): ~10:1 ✓
- Muted text (#94a3b8) on bg (#0f172a): ~6:1 ✓
- Sidebar text (#94a3b8) on sidebar (#1e293b): ~4.5:1 ✓
- Accent (#34d399) on bg (#0f172a): ~8:1 ✓

### Light Mode Contrast Checks
- Body text (#334155) on bg (#ffffff): ~9:1 ✓
- Muted text (#475569) on bg (#ffffff): ~7:1 ✓
- Sidebar text (#475569) on sidebar (#f8fafc): ~6:1 ✓
- Accent (#059669) on bg (#ffffff): ~4.5:1 ✓
