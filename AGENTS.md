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
