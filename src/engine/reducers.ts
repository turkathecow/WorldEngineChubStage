import {
  NormalizedLlmStageStateBlock,
  SoftFactsState,
  SoftNpcRecord,
  SoftSceneObjectRecord,
  StageChatState,
  StageInitState,
  StageMessageState,
} from "./types";
import { buildDashboardViewModel, getLocation } from "./selectors";
import { buildIncarnationNote, isSpawnedState } from "./spawnResolution";

const MAX_KNOWN_NPCS = 40;
const MAX_SCENE_OBJECTS = 50;
const MAX_RUMORS = 50;
const MAX_CODEX_UNLOCKS = 50;
const MAX_ENVIRONMENT_NOTES = 50;

export function ensureArrayIncludes(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values : [...values, nextValue];
}

export function createEmptySoftFactsState(): SoftFactsState {
  return {
    knownNpcs: [],
    sceneObjects: [],
    rumors: [],
    codexUnlocks: [],
    environmentNotes: [],
  };
}

function appendUniqueStrings(existing: string[], incoming: string[], maxItems: number): string[] {
  const seen = new Set(existing.map((value) => value.toLocaleLowerCase()));
  const next = [...existing];

  for (const value of incoming) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(value);
    if (next.length >= maxItems) {
      break;
    }
  }

  return next.slice(0, maxItems);
}

function mergeSoftNpcRecords(
  existing: SoftNpcRecord[],
  incoming: NormalizedLlmStageStateBlock["newNpcs"],
  messageId: string,
  totalMinutes: number,
): SoftNpcRecord[] {
  const next = [...existing];

  for (const candidate of incoming) {
    const currentIndex = next.findIndex((entry) => entry.id === candidate.id);
    if (currentIndex >= 0) {
      const current = next[currentIndex];
      next[currentIndex] = {
        ...current,
        name: current.name || candidate.name,
        role: current.role ?? candidate.role,
        locationHint: current.locationHint ?? candidate.locationHint,
        factionHint: current.factionHint ?? candidate.factionHint,
        dispositionHint: current.dispositionHint ?? candidate.dispositionHint,
        sourceMessageId: messageId,
        lastMentionedAtTotalMinutes: totalMinutes,
      };
      continue;
    }

    next.push({
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      locationHint: candidate.locationHint,
      factionHint: candidate.factionHint,
      dispositionHint: candidate.dispositionHint,
      sourceMessageId: messageId,
      firstMentionedAtTotalMinutes: totalMinutes,
      lastMentionedAtTotalMinutes: totalMinutes,
    });

    if (next.length >= MAX_KNOWN_NPCS) {
      break;
    }
  }

  return next.slice(0, MAX_KNOWN_NPCS);
}

function mergeSoftSceneObjectRecords(
  existing: SoftSceneObjectRecord[],
  incoming: NormalizedLlmStageStateBlock["newSceneObjects"],
  messageId: string,
  totalMinutes: number,
): SoftSceneObjectRecord[] {
  const next = [...existing];

  for (const candidate of incoming) {
    const currentIndex = next.findIndex((entry) => entry.id === candidate.id);
    if (currentIndex >= 0) {
      const current = next[currentIndex];
      next[currentIndex] = {
        ...current,
        name: current.name || candidate.name,
        description: current.description ?? candidate.description,
        locationHint: current.locationHint ?? candidate.locationHint,
        portable: current.portable ?? candidate.portable,
        sourceMessageId: messageId,
        lastMentionedAtTotalMinutes: totalMinutes,
      };
      continue;
    }

    next.push({
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      locationHint: candidate.locationHint,
      portable: candidate.portable,
      sourceMessageId: messageId,
      firstMentionedAtTotalMinutes: totalMinutes,
      lastMentionedAtTotalMinutes: totalMinutes,
    });

    if (next.length >= MAX_SCENE_OBJECTS) {
      break;
    }
  }

  return next.slice(0, MAX_SCENE_OBJECTS);
}

export function ensureSoftFactsState(messageState: StageMessageState): StageMessageState {
  return {
    ...messageState,
    softFacts: {
      ...createEmptySoftFactsState(),
      ...(messageState.softFacts ?? {}),
      knownNpcs: messageState.softFacts?.knownNpcs ?? [],
      sceneObjects: messageState.softFacts?.sceneObjects ?? [],
      rumors: messageState.softFacts?.rumors ?? [],
      codexUnlocks: messageState.softFacts?.codexUnlocks ?? [],
      environmentNotes: messageState.softFacts?.environmentNotes ?? [],
    },
  };
}

export function synchronizeScene(initState: StageInitState, messageState: StageMessageState): StageMessageState {
  if (!isSpawnedState(messageState) || !messageState.player.locationId) {
    return {
      ...messageState,
      scene: {
        ...messageState.scene,
        visibleActors: [],
        visibleObjects: [],
        immediateHazards: [],
      },
    };
  }

  const location = getLocation(initState, messageState.player.locationId);
  const nearbyActors = messageState.world.localActors[location.id] ?? [];
  const localWeather = messageState.world.weatherByRegion[location.regionId];
  const rumors = messageState.world.localRumors[location.id] ?? [];
  const locationKeys = new Set([location.id.toLocaleLowerCase(), location.name.toLocaleLowerCase()]);
  const softSceneObjects = messageState.softFacts.sceneObjects
    .filter((entry) => entry.locationHint === null || locationKeys.has(entry.locationHint.toLocaleLowerCase()))
    .map((entry) => entry.name);
  const hazards = [
    localWeather.activeEvent?.label ?? null,
    ...messageState.world.dynamicEvents
      .filter((event) => event.locationId === location.id || event.regionId === location.regionId)
      .map((event) => event.label),
    ...(localWeather.visibility === "poor" ? ["Low visibility"] : []),
  ].filter((entry): entry is string => entry !== null);

  return {
    ...messageState,
    scene: {
      ...messageState.scene,
      visibleActors: nearbyActors.map((actor) => actor.name),
      visibleObjects: Array.from(
        new Set(
          [
            location.kind === "city" ? "notice boards" : null,
            location.kind === "academy" ? "floating towers" : null,
            location.kind === "port" || location.kind === "frontier" ? "weather-beaten docks" : null,
            rumors.length > 0 ? "rumor scraps" : null,
            ...softSceneObjects,
          ].filter((entry): entry is string => entry !== null),
        ),
      ),
      immediateHazards: hazards,
    },
  };
}

export function synchronizeUI(messageState: StageMessageState): StageMessageState {
  return {
    ...messageState,
    ui: {
      ...messageState.ui,
      mapFocusLocationId:
        messageState.ui.mapFocusLocationId ??
        (isSpawnedState(messageState) ? messageState.player.locationId : null),
    },
  };
}

export function synchronizeAll(initState: StageInitState, messageState: StageMessageState): StageMessageState {
  return synchronizeUI(synchronizeScene(initState, ensureSoftFactsState(messageState)));
}

export function markExploration(initState: StageInitState, messageState: StageMessageState, chatState: StageChatState): StageChatState {
  if (!isSpawnedState(messageState) || !messageState.player.locationId) {
    return chatState;
  }
  const location = getLocation(initState, messageState.player.locationId);
  return {
    ...chatState,
    exploredLocations: ensureArrayIncludes(chatState.exploredLocations, location.id),
    discoveredLoreEntries: ensureArrayIncludes(chatState.discoveredLoreEntries, location.codexEntryId),
  };
}

export function buildEngineNote(initState: StageInitState, messageState: StageMessageState, chatState: StageChatState): string {
  if (!isSpawnedState(messageState)) {
    return buildIncarnationNote(messageState);
  }
  const dashboard = buildDashboardViewModel(initState, messageState, chatState);
  return `${dashboard.topLine.location} | ${dashboard.weather.conditionLabel} | ${dashboard.status.moneyLabel} | ${dashboard.status.fatigueLabel}`;
}

export function mergeSoftFactsIntoMessageState(
  messageState: StageMessageState,
  block: NormalizedLlmStageStateBlock,
  messageId: string,
): StageMessageState {
  const nextState = ensureSoftFactsState(messageState);

  return {
    ...nextState,
    softFacts: {
      // Soft facts stay separate from deterministic engine state so the LLM can enrich scenes without rewriting canonical truth.
      knownNpcs: mergeSoftNpcRecords(
        nextState.softFacts.knownNpcs,
        block.newNpcs,
        messageId,
        nextState.clock.totalMinutes,
      ),
      sceneObjects: mergeSoftSceneObjectRecords(
        nextState.softFacts.sceneObjects,
        block.newSceneObjects,
        messageId,
        nextState.clock.totalMinutes,
      ),
      rumors: appendUniqueStrings(nextState.softFacts.rumors, block.rumorsOrTensions, MAX_RUMORS),
      codexUnlocks: appendUniqueStrings(nextState.softFacts.codexUnlocks, block.suggestedCodexUnlocks, MAX_CODEX_UNLOCKS),
      environmentNotes: appendUniqueStrings(
        nextState.softFacts.environmentNotes,
        block.notableEnvironmentChanges,
        MAX_ENVIRONMENT_NOTES,
      ),
    },
  };
}
