<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vespera Application Rules & Architecture
These rules are mandatory for the Vespera Werewolf Moderator App.

## 1. Core Architecture
- **State Management**: We use a custom reactive object called `Stream` (located in `src/logic/antigravity/stream.ts`). DO NOT use Redux, Zustand, or Context for generic game state. 
- **Persistence**: Game state must survive hot-reloads and page refreshes. Every change to `playerList`, `gameStatus`, and `nightActions` streams is automatically saved to `localStorage`.
- **Draft Pattern**: All operations throughout the app that modify the state must follow the *Draft Pattern*. When interacting, states are compiled locally (using React state) and are ONLY flushed to the `gameStore` upon clicking a final "Confirm" or "Resolve" button. Example: Hunter Revenge targets and Night Engine targets.

## 2. Night Engine 'Ghost Pane' Rule
- If a role is eliminated from the game, they are still present in the Night sequence to **preserve the mystery** and timing.
- If an eliminated role's turn triggers, do NOT show the normal action buttons. Show the *Ghost Pane* (`Role is Eliminated`) and do not allow the moderator to select any targets.

## 3. UI/UX Principles
- **Mobile First**: All layouts must use responsive frameworks, stack nicely, and use CSS `grid` effectively.
- **Visuals**: Utilize vibrant colors (`text-purple-400`, `text-destructive`, `text-green-500`), icons from `lucide-react`, and tracking/uppercase stylings for crucial events.

## 4. Role Interactions
Role-specific game logic, constraints, and night-waking sequences are strictly defined in an external document.
**See the full role specifications here:** [ROLE_INTERACTIONS.md](./ROLE_INTERACTIONS.md)


# Agent Operational Guidelines: Efficiency & Focus

## 1. Core Execution Principle
- **Task-Centric Approach**: Focus exclusively on the primary task defined in the user prompt. Do not deviate into unrelated features or suggest "nice-to-have" improvements unless explicitly asked.
- **Minimalism in Communication**: Provide concise explanations. Avoid conversational filler (e.g., "I understand," "Here is the solution," "I hope this helps"). Jump straight to the technical implementation or the answer.

## 2. Response Formatting
- **Code-First**: If the task is coding, prioritize providing the code block immediately. Keep prose to a minimum, using it only to explain complex logic or critical warnings.
- **No Redundancy**: Do not repeat the user's prompt or summarize what you are about to do. Just do it.
- **Direct Answers**: For conceptual questions, provide a structured response (bullet points or tables) instead of long-form paragraphs.

## 3. Scope Control
- **Strict Boundary**: Stay within the current file context or the specific module being discussed. Do not refactor unrelated files unless a global change is strictly necessary for the task to function.
- **Zero Hallucination**: If a requirement is ambiguous, ask a single clarifying question instead of making assumptions and generating redundant code.

## 4. Antigravity & Next.js Context
- **Technical Precision**: When implementing logic for Project Vespera, focus on reactive patterns (Streams/Atoms). Do not provide boilerplate for standard React state if the project rules dictate Antigravity.

If the response can be purely code or a table, omit all introductory and concluding text.