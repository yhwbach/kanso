# Kanso design system

One language, two inks. Kanso looks like a small piece of hardware with a dot-matrix display: numerals in Doto, labels in JetBrains Mono, body text in Inter, dashed hairlines, two-pixel corners, and exactly one colour, red, for what is live or needs you. Dark mode is black paper with white ink. Light mode is the same drawing on white paper with black ink. Nothing else changes between them.

The tokens live in `apps/frontend/src/styles/globals.css`; every component reads them, so a screen never knows which mode it is in.

## Color

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | #f6f6f6 | #0b0b0b | page |
| `--bg2` | #ededed | #121212 | tiles |
| `--surface` | #ffffff | #161616 | panels, chips, toasts, inputs |
| `--line` | #dcdcdc | #262626 | hairlines |
| `--line2` | #bdbdbd | #3a3a3a | panel dashes, ghost buttons |
| `--ink` | #0b0b0b | #f2f2f2 | text, on state |
| `--ink2` | #4f4f4f | #a5a5a5 | secondary text |
| `--ink3` | #8a8a8a | #6b6b6b | labels, placeholders |
| `--accent` | #d71921 | #d71921 | primary action, attention, offline |

Neutral ramp, light to dark: #ffffff, #f6f6f6, #ededed, #dcdcdc, #bdbdbd, #8a8a8a, #4f4f4f, #3a3a3a, #262626, #161616, #0b0b0b.
Accent ramp: #fbd8da, #f5a3a8, #ee6a72, #e43a44, #d71921, #ae141b, #830f14, #560a0d.

Red is the only colour that means something: the one action to take, the device that is unreachable, the detail that was hidden. "On" is ink, not colour.

## Type

| Role | Face |
| --- | --- |
| Display (`.display`) | Doto 700, uppercase, +2% tracking |
| Numerals (`.numerals`) | Doto 900, tabular |
| Body (`--ui`) | Inter |
| Labels (`.label`) | JetBrains Mono 500, 11 px, +12% tracking, uppercase |

Display sizes are fluid: `clamp(48px, 11vw, 128px)` on the landing hero, `clamp(40px, 8vw, 84px)` for the home greeting, `clamp(36px, 7vw, 72px)` for section pages.

## Shape

Two-pixel corners on controls, four on panels. Panels are dashed, tiles are solid hairlines, nothing has a shadow. The rocker toggle is a square knob sliding in a track; the LED is a square dot.

## Components

`.panel` section container. `.tile` device or option card; `.on` fills it and inks the border, `.bad` makes the border red. `.led` state dot; `.on` is ink, `.bad` glows red. `.rocker` toggle; `.on` slides the knob. `.btn` with `primary`, `ghost`, `ink`. `.field` text input in mono. `.chip` with `active` and `dashed`. `.label` tracked caption.

## Navigation

There is no menu bar. The header holds the mark, the home switcher, the theme toggle and the avatar, all as 36 px squares on one line. Sections live in the bottom bar: one square beside the command field opens an upward list of Home, Privacy and Automations, and the current section is named next to it. The eye never has to travel between the top and the bottom of the screen to act.

## Layout

Phone, tablet and desktop share one layout that reflows: the home switcher moves under the header below 1024 px, device tiles go from four columns to two, the attention card moves above the devices, and the suggestion chips above the command field hide below 768 px.

## Motion

Everything is transform or opacity. Rise on mount with a 50 ms stagger, pop when a device changes state, the knob overshoots on a spring, a dot travels the hub link while it restarts, the mic ring scales with the live level. `prefers-reduced-motion` turns all of it into instant state changes.

## Voice

The interface never uses technical words. Devices are reachable or not, details are hidden, automations are built. Numbers appear only when they change what the person does: the timer, and one typical speed on the privacy page. Nothing is captioned with milliseconds.

## Mark

The Kanso mark is an enso, the Zen circle drawn in one breath, with the voice held inside it and a single red point where the brush landed. Sources: `apps/frontend/public/brand/`.

## Screens

Light and dark captures of every screen are in `screenshots/` (`*.png` and `*-dark.png`), with phone-width captures as `*-phone.png`.
