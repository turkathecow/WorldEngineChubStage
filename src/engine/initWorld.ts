import {
  DEFAULT_CHAT_STATE,
  DEFAULT_CONFIG,
  DEFAULT_START_CLOCK,
  EMPTY_INIT_STATE,
  EMPTY_MESSAGE_STATE,
} from "./defaults";
import { buildClockState } from "./clock";
import { buildInitialEvents, buildLocalRumors } from "./events";
import { markExploration, synchronizeAll } from "./reducers";
import { maybeMarkExplorationForSpawn, createUnresolvedPlayerState, isSpawnedState, buildIncarnationNote } from "./spawnResolution";
import { recalculateRouteConditions } from "./travel";
import { buildInitialWeather } from "./weather";
import { StageChatState, StageConfig, StageInitState, StageMessageState } from "./types";

export function normalizeConfig(config: StageConfig | null): StageConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
  };
}

export function createInitState(config: StageConfig): StageInitState {
  return EMPTY_INIT_STATE(config);
}

export function createChatState(existing: StageChatState | null): StageChatState {
  return existing ?? { ...DEFAULT_CHAT_STATE };
}

function buildSettlementStates(initState: StageInitState): StageMessageState["world"]["settlementStates"] {
  return Object.fromEntries(
    initState.mapDef.locations.map((location) => [
      location.id,
      {
        locationId: location.id,
        marketMood: location.market ? "stable" : "tight",
        tension:
          location.id === "ascalos-watch" || location.id === "great-central-foothold"
            ? 55
            : location.id === "gursa-city"
              ? 30
              : 20,
        authority:
          location.id === "gursa-city"
            ? "Gursa Treaty Council"
            : location.id === "eter-royal-magic-academy"
              ? "Eter faculty oathkeepers"
              : "Local custom and force",
        notableIssue:
          location.id === "ascalos-watch"
            ? "Raid reports"
            : location.id === "great-central-foothold"
              ? "Expedition attrition"
              : location.id === "gursa-city"
                ? "Overcrowded guild traffic"
                : null,
      },
    ]),
  );
}

function buildLocalActors(initState: StageInitState): StageMessageState["world"]["localActors"] {
  return Object.fromEntries(
    initState.mapDef.locations.map((location) => [
      location.id,
      initState.staticActors
        .filter((actor) => actor.locationId === location.id)
        .map((actor) => ({
          id: actor.id,
          name: actor.name,
          role: actor.role,
          disposition: actor.disposition,
          factionId: actor.factionId ?? null,
          locationId: actor.locationId,
          note: actor.note,
        })),
    ]),
  );
}

function populateGlobalWorld(initState: StageInitState, messageState: StageMessageState): StageMessageState {
  const nextState = {
    ...messageState,
    world: {
      ...messageState.world,
    },
  };

  if (Object.keys(nextState.world.weatherByRegion).length === 0) {
    nextState.world.weatherByRegion = buildInitialWeather(initState, nextState.clock);
  }
  if (Object.keys(nextState.world.routeConditions).length === 0) {
    nextState.world.routeConditions = recalculateRouteConditions(initState, nextState);
  }
  if (nextState.world.dynamicEvents.length === 0) {
    nextState.world.dynamicEvents = buildInitialEvents(initState, nextState.clock.totalMinutes);
  }
  if (Object.keys(nextState.world.localRumors).length === 0) {
    nextState.world.localRumors = buildLocalRumors(initState, nextState);
  }
  if (Object.keys(nextState.world.settlementStates).length === 0) {
    nextState.world.settlementStates = buildSettlementStates(initState);
  }
  if (Object.keys(nextState.world.localActors).length === 0) {
    nextState.world.localActors = buildLocalActors(initState);
  }

  return nextState;
}

export function createInitialMessageState(initState: StageInitState): StageMessageState {
  const initialState = EMPTY_MESSAGE_STATE();
  initialState.clock = buildClockState(
    DEFAULT_START_CLOCK.year,
    DEFAULT_START_CLOCK.month,
    DEFAULT_START_CLOCK.day,
    DEFAULT_START_CLOCK.hour,
    DEFAULT_START_CLOCK.minute,
    initState.worldDef.calendarDef,
  );
  initialState.player = createUnresolvedPlayerState();
  initialState.ui.mapFocusLocationId = null;
  initialState.ui.lastEngineNote = buildIncarnationNote(initialState);
  return synchronizeAll(initState, populateGlobalWorld(initState, initialState));
}

function hydrateExistingMessageState(initState: StageInitState, messageState: StageMessageState): StageMessageState {
  const emptyState = EMPTY_MESSAGE_STATE();
  const nextState: StageMessageState = {
    ...emptyState,
    ...messageState,
    player: {
      ...emptyState.player,
      ...(messageState.player ?? {}),
    },
    world: {
      ...emptyState.world,
      ...(messageState.world ?? {}),
    },
    scene: {
      ...emptyState.scene,
      ...(messageState.scene ?? {}),
    },
    softFacts: {
      ...emptyState.softFacts,
      ...(messageState.softFacts ?? {}),
    },
    ui: {
      ...emptyState.ui,
      ...(messageState.ui ?? {}),
    },
  };

  nextState.incarnationPhase =
    messageState.incarnationPhase ??
    (nextState.player.locationId && nextState.player.regionId ? "spawned" : "unresolved");
  nextState.spawnCandidate = messageState.spawnCandidate ?? null;

  if (nextState.incarnationPhase !== "spawned") {
    nextState.player = createUnresolvedPlayerState();
    nextState.scene = {
      ...nextState.scene,
      visibleActors: [],
      visibleObjects: [],
      immediateHazards: [],
    };
    nextState.ui.mapFocusLocationId = null;
  }

  if (!nextState.ui.lastEngineNote) {
    nextState.ui.lastEngineNote = buildIncarnationNote(nextState);
  }

  return populateGlobalWorld(initState, nextState);
}

export function hydrateState(
  initState: StageInitState,
  messageState: StageMessageState | null,
  chatState: StageChatState | null,
): { messageState: StageMessageState; chatState: StageChatState } {
  const hydratedMessageState = messageState ? hydrateExistingMessageState(initState, messageState) : createInitialMessageState(initState);
  const nextMessageState = synchronizeAll(initState, hydratedMessageState);
  const nextChatState = isSpawnedState(nextMessageState)
    ? maybeMarkExplorationForSpawn(initState, nextMessageState, markExploration(initState, nextMessageState, createChatState(chatState)))
    : createChatState(chatState);
  return {
    messageState: nextMessageState,
    chatState: nextChatState,
  };
}
