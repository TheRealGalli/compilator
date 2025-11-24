# Design Guidelines: NotebookLM Clone with Integrated Compiler

## Design Approach

**Selected Approach:** Design System (Material Design 3) with productivity tool patterns from Linear, VS Code, and Notion.

**Justification:** This is a utility-focused, information-dense productivity application requiring consistent, functional UI patterns. Drawing from Google's Material Design 3 ensures alignment with NotebookLM's aesthetic while maintaining modern, efficient workflows.

**Key Principles:**
- Clarity over decoration
- Information density with breathing room
- Seamless multi-panel navigation
- Code-first aesthetics for technical users

---

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) - all UI text, headings
- Code: JetBrains Mono - code editor and output

**Hierarchy:**
- H1: 2xl, font-semibold (Notebook titles)
- H2: xl, font-semibold (Section headers)
- H3: lg, font-medium (Panel titles)
- Body: base, font-normal (Content, chat)
- Small: sm, font-normal (Metadata, timestamps)
- Code: sm, font-mono (Code blocks, editor)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 24** (e.g., p-4, gap-6, mb-8)

**Grid Structure:**
- Three-panel layout: Sidebar (280px) | Main Content (flex-1) | Right Panel (360px, collapsible)
- Sidebar: Navigation, notebooks list, source management
- Main: Primary workspace (documents, chat, compiler based on active tab)
- Right: Contextual panels (document outline, chat history, compiler output)

**Responsive Breakpoints:**
- Mobile: Single panel, bottom tab navigation
- Tablet: Two-panel (collapsible sidebar)
- Desktop: Full three-panel experience

---

## Component Library

### Navigation & Structure

**Top App Bar:**
- Height: 56px, fixed position
- Logo + notebook title (left), user avatar + settings (right)
- Subtle bottom border for separation

**Sidebar Navigation:**
- Notebook tree with expand/collapse
- Source file list with icons (PDF, DOCX, TXT)
- "New Notebook" prominent CTA button
- Section tabs: Documents, Chat, Compiler, Generated Content

**Tab System:**
- Horizontal tabs for main sections (Documents/Chat/Compiler/Outputs)
- Active tab: bottom border accent, medium font-weight
- Inactive: regular weight, subdued treatment

### Document Management

**File Upload Zone:**
- Drag-and-drop area with dashed border
- Icon + "Drop files here or click to browse"
- Supported formats displayed below
- Compact file cards after upload (name, size, remove button)

**Document Viewer:**
- Clean reading interface with max-width prose container
- Floating toolbar for actions (summarize, generate notes, extract topics)
- Inline citations and highlights when referenced in chat

### Chat Interface

**Message Container:**
- User messages: right-aligned, contained width
- AI responses: left-aligned, full-width with subtle background
- Timestamp + copy button on hover
- Source citations as clickable chips below responses

**Input Area:**
- Fixed bottom position, elevated shadow
- Textarea with auto-expand (max 4 lines before scroll)
- Send button (icon-only) + attachment option
- Suggested prompts as chips above input when empty

### Compiler Section

**Code Editor:**
- Full-height split panel: Editor (60%) | Output (40%)
- Language selector dropdown (JavaScript/Python)
- Run button: prominent, positioned top-right of editor
- Line numbers, syntax highlighting via library (Prism.js or Monaco)

**Output Console:**
- Tabbed interface: Console / Results / Errors
- Monospace font, dark background treatment
- Clear output button, download results option
- Auto-scroll to latest output

### Generated Content

**Content Cards:**
- Summary, Study Notes, FAQ, Mind Maps as separate cards
- Card header: title + regenerate + download actions
- Rich formatted content with proper hierarchy
- Expand/collapse for lengthy outputs

---

## Component Specifications

**Buttons:**
- Primary: medium size, rounded corners (rounded-lg)
- Icon buttons: square, equal padding
- Floating action buttons: fixed positioning with shadow

**Input Fields:**
- Border treatment with focus state
- Helper text below in small size
- Error states with validation messages

**Cards:**
- Subtle border, rounded-lg, consistent padding (p-6)
- Hover state: slight shadow elevation
- Header/Body/Footer sections clearly defined

**Modals/Dialogs:**
- Centered overlay with backdrop blur
- Max-width constraints (max-w-2xl for forms)
- Close button top-right, primary action bottom-right

**Loading States:**
- Skeleton screens for content loading
- Spinner for actions (analyzing documents, running code)
- Progress indicators for file uploads

---

## Animations

**Minimal, Purposeful Motion:**
- Panel transitions: 200ms ease-in-out when opening/closing
- Tab switches: 150ms smooth fade
- Hover states: 100ms for buttons and interactive elements
- **No** scroll-triggered animations, parallax, or decorative motion

---

## Images

**No Hero Image Required** - This is a productivity application focused on functionality.

**Icon Usage:**
- Use **Heroicons** (via CDN) consistently throughout
- Document type icons in file lists
- Action icons in toolbars (play for run, copy, download)
- Navigation icons in sidebar

**Generated Content Visualization:**
- Mind maps: Use mermaid.js or similar for diagrams
- Charts/graphs for data analysis if applicable

---

## Layout Notes

**Multi-Panel Coordination:**
- Panels communicate through subtle highlighting (e.g., clicking chat citation highlights document section)
- Resizable panel dividers for user customization
- Collapse buttons for focused work modes

**Density Options:**
- Compact mode for power users (reduced padding, smaller fonts)
- Default comfortable spacing as specified
- Toggle in settings menu

---

This design creates a professional, efficient workspace that balances NotebookLM's research capabilities with powerful code execution, maintaining clarity and usability for technical users.