---
name: design-picker
description: >
  Intelligent design system selector and applicator for frontend/web projects.
  Contains 32 production-ready design system prompts (sourced from designprompts.dev)
  with automatic style selection, combination logic, and implementation guidance.

  USE THIS SKILL whenever the user wants to:
  - Build any frontend UI, web page, landing page, dashboard, component, or web app
  - Choose a visual style or design direction for a project
  - Redesign or restyle existing components or pages
  - Get design system recommendations based on project type, audience, or vibe
  - Combine multiple design aesthetics into a cohesive hybrid
  - Apply a specific named style (e.g. "cyberpunk", "brutalist", "minimal dark")

  Also trigger when the user mentions: design system, visual style, UI aesthetic,
  look and feel, theme, branding, design tokens, styling, CSS architecture,
  component library styling, or any of the 32 style names listed in this skill.

  This skill is the FIRST STEP before writing any frontend code. Always select
  a design system before generating UI code to avoid generic/boilerplate output.
---

# Design Picker Skill

An intelligent design system selector that analyzes project context, recommends
the optimal visual style (or style combination), and provides complete design
tokens, component patterns, and implementation guidance for 32 distinct aesthetics.

---

## How This Skill Works

```
User Request → Analyze Context → Select Style(s) → Load Prompt(s) → Build
```

1. **Analyze** what the user is building (type, audience, vibe, constraints)
2. **Recommend** 1-3 styles with reasoning — let the user pick or auto-select
3. **Load** the full design system prompt from `prompts/<StyleName>.md`
4. **Apply** tokens, patterns, and anti-patterns while writing code

---

## Available Styles (32)

Read `references/styles-catalog.md` for the complete catalog with categories,
vibes, keywords, and best-use-cases for every style.

**Quick overview by category:**

| Category     | Styles |
|-------------|--------|
| Modern      | Claymorphism, Fluent 2, Material, Modern Dark, Neumorphism, SaaS |
| Minimal     | Bauhaus, Flat Design, Minimal Dark, Monochrome, Swiss |
| Creative    | Bold Typography, Maximalism, Neo-brutalism, Playful Geometric, Sketch |
| Professional| Enterprise, Professional |
| Elegant     | Academia, Art Deco, Humanist Literary, Luxury |
| Tech        | Terminal CLI, Web3 |
| Organic     | Botanical, Organic |
| Futuristic  | Cyberpunk |
| Nostalgic   | Retro, Vaporwave |
| Editorial   | Newsprint |
| Dynamic     | Kinetic |
| Raw         | Industrial |

---

## Step 1: Context Analysis

Before selecting a style, gather (or infer) these signals:

### From the request itself:
- **Project type**: landing page, dashboard, portfolio, blog, e-commerce, SaaS app, docs, mobile app, game UI...
- **Industry/domain**: tech, finance, health, creative, education, crypto, gaming...
- **Target audience**: developers, executives, consumers, kids, luxury buyers...
- **Explicit style words**: "modern", "dark", "bold", "clean", "futuristic"...
- **Reference sites**: if user mentions sites like Linear, Stripe, Gumroad — map to closest style
- **Mood/vibe**: "professional but not boring", "playful", "serious", "edgy"

### From the codebase (if visible):
- Tech stack (React, Vue, Next.js, Tailwind, plain CSS...)
- Existing design tokens or theme files
- Current visual direction (dark/light, rounded/sharp, etc.)

**If context is insufficient, ask ONE focused question:**
> "What vibe are you going for? I have 32 design styles — from Swiss minimalism
> to Cyberpunk neon to Neo-brutalist chaos. Quick options: modern & sophisticated,
> bold & creative, clean & minimal, or something specific?"

---

## Step 2: Style Selection Logic

### A) Direct Match — User names a style
Map directly. Case-insensitive, fuzzy matching:

| User says | Load |
|-----------|------|
| "brutalist", "neo-brutalism" | Neo-brutalism.md |
| "cyberpunk", "neon", "glitch" | Cyberpunk.md |
| "modern dark", "linear-style", "vercel-style" | ModernDark.md |
| "minimal", "clean", "swiss" | Swiss.md |
| "material", "google-style" | Material.md |
| "terminal", "cli", "hacker" | TerminalCLI.md |
| "luxury", "premium", "high-end" | Luxury.md |
| "retro", "vintage" | Retro.md |
| "vaporwave", "80s/90s aesthetic" | Vaporwave.md |
| "newspaper", "editorial" | Newsprint.md |
| "sketch", "hand-drawn" | Sketch.md |
| "saas", "startup" | Saas.md |
| "enterprise", "corporate" | Enterprise.md |
| "academic", "scholarly" | Academia.md |
| "art deco", "1920s" | ArtDeco.md |
| "industrial", "factory" | Industrial.md |
| "botanical", "nature", "plants" | Botanical.md |
| "organic", "flowing" | Organic.md |
| "monochrome", "black & white" | Monochrome.md |
| "flat", "2D" | FlatDesign.md |
| "bauhaus", "geometric minimal" | Bauhaus.md |
| "neumorphism", "soft ui" | Neumorphism.md |
| "claymorphism", "clay 3d" | Claymorphism.md |
| "fluent", "microsoft", "windows" | Fluent2.md |
| "bold type", "typography-driven" | BoldTypography.md |
| "maximalism", "more is more" | Maximalism.md |
| "kinetic", "motion-heavy" | Kinetic.md |
| "web3", "crypto", "blockchain" | Web3.md |
| "playful", "geometric fun" | PlayfulGeometric.md |
| "professional", "business" | Professional.md |
| "minimal dark" | MinimalDrak.md |
| "humanist", "literary", "warm editorial" | HumanistLiterary.md |

### B) Project-Type Recommendation — No style specified

| Building... | Primary recommendation | Alternatives |
|-------------|----------------------|-------------|
| SaaS / web app | Modern Dark | SaaS, Professional |
| E-commerce | Luxury | Professional, Modern Dark |
| Portfolio / creative | Swiss | Neo-brutalism, Sketch |
| Blog / content | Newsprint | Swiss, Minimal Dark, Humanist Literary |
| Dashboard / admin | Modern Dark | Material, Enterprise, Fluent 2 |
| Landing page | Modern Dark | Neo-brutalism, SaaS |
| Mobile app | Material | Neumorphism, Flat Design |
| Developer tool | Terminal CLI | Modern Dark, Minimal Dark |
| Crypto / DeFi | Web3 | Cyberpunk |
| Creative agency | Neo-brutalism | Maximalism, Sketch |
| Wellness / health | Botanical | Organic, Claymorphism |
| Corporate / B2B | Enterprise | Professional, Fluent 2 |
| Education | Academia | Professional |
| Documentation | Humanist Literary | Professional, Swiss |
| Conversational AI | Humanist Literary | Minimal Dark |
| Game UI | Cyberpunk | Retro, Vaporwave |
| News / magazine | Newsprint | Bold Typography |
| Event / conference | Kinetic | Bold Typography |

### C) Vibe-Based Selection — User describes a feeling

| Vibe description | Best match(es) |
|-----------------|----------------|
| "dark and sophisticated" | Modern Dark |
| "clean and professional" | Swiss, Professional |
| "bold and rebellious" | Neo-brutalism |
| "fun and colorful" | Playful Geometric, Claymorphism |
| "elegant and premium" | Luxury, Art Deco |
| "techy and futuristic" | Cyberpunk, Web3 |
| "warm and natural" | Botanical, Organic, Humanist Literary |
| "nostalgic and retro" | Retro, Vaporwave |
| "dense and information-rich" | Newsprint, Enterprise |
| "animated and dynamic" | Kinetic |
| "raw and industrial" | Industrial, Neo-brutalism |
| "calm and readable" | Humanist Literary, Swiss |
| "corporate but modern" | Enterprise, Fluent 2 |

---

## Step 3: Style Combinations (Hybrid Approach)

Sometimes a single style isn't enough. Use this framework for combining:

### Combination Rules

1. **Pick a PRIMARY style** — this defines: color system, typography, spacing, overall vibe
2. **Pick a SECONDARY style** — borrow ONLY specific elements: border treatment, shadow style, animation approach, or accent patterns
3. **Never combine more than 2 styles** — more creates visual chaos
4. **Ensure category compatibility** — see the compatibility matrix below

### Compatibility Matrix

```
✅ = Great combo   ⚠️ = Use carefully   ❌ = Avoid

                    Modern  Minimal  Creative  Professional  Elegant  Tech
Modern              —       ✅       ⚠️        ✅            ✅       ✅
Minimal             ✅      —        ⚠️        ✅            ✅       ✅
Creative            ⚠️      ⚠️       —         ❌            ❌       ⚠️
Professional        ✅      ✅       ❌        —             ✅       ✅
Elegant             ✅      ✅       ❌        ✅            —        ⚠️
Tech                ✅      ✅       ⚠️        ✅            ⚠️       —
```

### Popular Combinations

| Combo name | Primary | Secondary (borrow what) |
|-----------|---------|------------------------|
| "Dark Brutalist" | Modern Dark | Neo-brutalism (borders, shadows) |
| "Elegant Tech" | Luxury | Modern Dark (glass effects, animations) |
| "Warm Minimal" | Swiss | Humanist Literary (typography warmth) |
| "Corporate Modern" | Enterprise | Modern Dark (depth, visual polish) |
| "Retro Cyber" | Vaporwave | Cyberpunk (glitch effects, neon) |
| "Nature SaaS" | SaaS | Botanical (color palette, organic shapes) |
| "Academic Dark" | Academia | Minimal Dark (dark background adaptation) |
| "Editorial Bold" | Newsprint | Bold Typography (type scale, weight) |
| "Playful SaaS" | SaaS | Claymorphism (card style, soft 3D) |
| "Industrial Minimal" | Swiss | Industrial (texture, raw elements) |

### How to Combine in Practice

```
1. Load PRIMARY prompt → apply ALL design tokens (colors, type, spacing)
2. Load SECONDARY prompt → extract ONLY the specific borrowed elements
3. Resolve conflicts:
   - Colors: ALWAYS from primary
   - Typography: primary base, secondary for accent/display only
   - Borders/shadows: can come from secondary
   - Animations: can come from secondary
   - Layout: ALWAYS from primary
4. Document the hybrid in a comment at the top of your CSS/theme file
```

---

## Step 4: Load and Apply

Once style is selected, read the full prompt file:

```
Read: prompts/<StyleName>.md
```

Each prompt contains:
- **Design Philosophy** — the "why" behind the style
- **Color System** — complete palette with semantic tokens
- **Typography** — font stacks, scales, weights
- **Spacing & Layout** — grid system, section padding
- **Component Patterns** — buttons, cards, forms, navigation
- **Signature Elements** — the "bold factors" that make it unique
- **Anti-Patterns** — what NOT to do (critical for authenticity)
- **Animation/Motion** — interaction and transition specs

### Implementation Checklist

Before delivering any code, verify:

- [ ] Design tokens centralized (CSS variables or theme config)
- [ ] Signature elements implemented (check "Bold Factor" in prompt)
- [ ] Anti-patterns avoided (check "Anti-Patterns" section)
- [ ] Responsive breakpoints defined
- [ ] Interactive states (hover, focus, active) follow the style
- [ ] Accessibility: contrast ratios, focus indicators, keyboard nav
- [ ] Animations match the style's motion language
- [ ] Code matches user's existing patterns (framework, naming, structure)

---

## Step 5: Reference Site Mapping

When user references a known website, map to the closest style:

| Reference site | Closest style |
|---------------|--------------|
| Linear.app | Modern Dark |
| Vercel.com | Modern Dark |
| Stripe.com | Professional + Modern Dark |
| Gumroad.com | Neo-brutalism |
| Apple.com | Swiss / Minimal |
| notion.so | Flat Design / Professional |
| figma.com | SaaS |
| supabase.com | Modern Dark |
| tailwindcss.com | SaaS |
| arc.net | Modern Dark |
| read.cv | Swiss / Humanist Literary |
| Rauno.me | Minimal Dark + Kinetic |
| Pentagram.com | Swiss + Bold Typography |
| Bloomberg.com | Enterprise + Newsprint |
| Vogue.com | Luxury + Bold Typography |

---

## Quick Decision Flowchart

```
START
  │
  ├─ User named a specific style?
  │   YES → Load that style directly (Step 2A)
  │
  ├─ User described a vibe/feeling?
  │   YES → Map via vibe table (Step 2C)
  │
  ├─ User mentioned a reference site?
  │   YES → Map via reference table (Step 5)
  │
  ├─ User described the project type?
  │   YES → Recommend via project table (Step 2B)
  │
  └─ Not enough info?
      → Ask ONE question, then recommend top 2-3 options
        with brief reasoning. Let user pick.
```

---

## File Structure

```
design-picker/
├── SKILL.md                      ← You are here (decision logic)
├── references/
│   └── styles-catalog.md         ← Full catalog with metadata for all 32 styles
└── prompts/                      ← 32 complete design system prompts
    ├── Academia.md
    ├── ArtDeco.md
    ├── Bauhaus.md
    ├── BoldTypography.md
    ├── Botanical.md
    ├── Claymorphism.md
    ├── Cyberpunk.md
    ├── Enterprise.md
    ├── FlatDesign.md
    ├── Fluent2.md
    ├── HumanistLiterary.md
    ├── Industrial.md
    ├── Kinetic.md
    ├── Luxury.md
    ├── Material.md
    ├── Maximalism.md
    ├── MinimalDrak.md
    ├── ModernDark.md
    ├── Monochrome.md
    ├── Neo-brutalism.md
    ├── Neumorphism.md
    ├── Newsprint.md
    ├── Organic.md
    ├── PlayfulGeometric.md
    ├── Professional.md
    ├── Retro.md
    ├── Saas.md
    ├── Sketch.md
    ├── Swiss.md
    ├── TerminalCLI.md
    ├── Vaporwave.md
    └── Web3.md
```

When loading a style, read the FULL prompt file — every section matters.
For combinations, load both files and follow the merge rules in Step 3.
