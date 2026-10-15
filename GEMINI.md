# UI/UX & Design Intelligence Directive: UI/UX Pro Max

## Mandatory Requirement
Whenever designing, modifying, reviewing, building, or styling any user interface (UI), CSS, HTML, JavaScript frontend components, layouts, color schemes, typography, micro-animations, or overall user experience (UX) in this project:

**YOU MUST ALWAYS USE THE `ui-ux-pro-max` SKILL AS THE EXCLUSIVE DESIGN INTELLIGENCE ENGINE.**

## How to Apply `ui-ux-pro-max`
1. **Skill Location**: `.agents/skills/ui-ux-pro-max/`
2. **Search Engine Execution**:
   Run design queries using Python against the local skill database:
   ```bash
   python .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
   ```
   Or for complete design system recommendations:
   ```bash
   python .agents/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --design-system -p "Project Name"
   ```

3. **Core Standards Enforced**:
   - **Accessibility (CRITICAL)**: WCAG contrast 4.5:1 minimum, alt text, full keyboard navigation, aria-labels for icon buttons, visible focus indicators.
   - **Touch & Targets**: Minimum clickable/tap dimensions 44×44px, 8px+ minimum spacing, immediate visual feedback.
   - **Performance**: High visual efficiency, no layout thrashing, zero Cumulative Layout Shift (CLS < 0.1).
   - **Typography & Color**: Base 16px, line-height 1.5, semantic CSS variables / tokens, no gray-on-gray low-contrast text.
   - **Icons**: Crisp SVG icons with proper aria labeling; never emoji as icons.
   - **Animations**: Purposeful micro-interactions (150ms–300ms), context-aware easing, respect `prefers-reduced-motion`.
