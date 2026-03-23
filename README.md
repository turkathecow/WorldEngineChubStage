# Medieval Isekai World Engine

This project turns the Chub Stage template into a deterministic simulation layer for the Medieval Isekai setting. The LLM handles prose and scene narration. The stage handles canonical world facts, time, weather, route state, player state, inventory, money, fatigue, injuries, reputation, and compact prompt injection.

## Architecture

The implementation is split into a reusable engine and a setting-specific data pack:

- `src/engine/types.ts`: strongly typed init, message, chat, config, and UI models.
- `src/engine/defaults.ts`: Medieval Isekai content pack and default configuration.
- `src/engine/initWorld.ts`: init-state assembly and first-load hydration.
- `src/engine/clock.ts`, `weather.ts`, `travel.ts`, `inventory.ts`, `conditions.ts`, `economy.ts`, `factions.ts`, `events.ts`: deterministic simulation helpers.
- `src/engine/resolveAction.ts`: lightweight action interpreter and turn reducer.
- `src/engine/promptBridge.ts`: compact canonical state injected before generation.
- `src/ui/*`: dashboard panels.
- `src/Stage.tsx`: lifecycle orchestration only.

Mutable simulation state lives in message state. Static world blueprint lives in init state. Cross-branch discoveries live in chat state.

## World Scope in V1

The world blueprint is curated rather than exhaustive. It currently includes:

- World anchors: Lumeria, Orisc, Marusa Sea, Great Central Mountain.
- Locations: Niria, Gursa, Eter Royal Magic Academy, Ascalos Watch, Brisco Docks, Great Central Foothold, Omega Rilias Fangs Approach.
- Factions: Aihalid Guild, Gursa Treaty Council, Eter Royal Magic Academy, Brotherhood of the Golden Sun, Kingdom of Ardanthal.
- Weather zones: temperate plains, arcane marsh, sea/coast, cold highland, Great Central anomaly belt.

To expand the setting later, add new content to `src/engine/defaults.ts` first. The simulation helpers already operate on generic regions, locations, routes, factions, items, and weather zones.

## Local Development

Use either `npm` or `yarn` locally.

```bash
npm install
npm run dev
```

In development, `src/TestRunner.tsx` renders a local control panel. It runs `beforePrompt` directly and shows the canonical prompt bridge block so state changes can be inspected without the chat host.

## Extension Notes

The cleanest v2 extensions are:

1. Add more locations, routes, factions, and codex entries in `src/engine/defaults.ts`.
2. Add more deterministic action categories in `src/engine/resolveAction.ts`.
3. Expand market, injury, and event depth without moving mutable data out of message state.
4. Layer more chat-state discoveries such as unlocked codex sections, route charts, or faction dossiers.
