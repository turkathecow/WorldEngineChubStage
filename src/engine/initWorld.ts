import {
  DEFAULT_CHAT_STATE,
  DEFAULT_CONFIG,
  DEFAULT_START_CLOCK,
  EMPTY_INIT_STATE,
  EMPTY_MESSAGE_STATE,
} from "./defaults";
import { buildClockState } from "./clock";
import { copperToWallet } from "./economy";
import { addInventoryItem } from "./inventory";
import { buildInitialEvents, buildLocalRumors } from "./events";
import { markExploration, synchronizeAll } from "./reducers";
import { recalculateRouteConditions } from "./travel";
import { buildInitialWeather } from "./weather";
import { QuestState, StageChatState, StageConfig, StageInitState, StageMessageState } from "./types";

export function normalizeConfig(config: StageConfig | null): StageConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
  };
}

function buildInitialQuests(initState: StageInitState, questIds: string[]): QuestState[] {
  return questIds
    .map((questId) => initState.questCatalog.find((candidate) => candidate.id === questId))
    .filter((quest): quest is NonNullable<typeof quest> => quest !== undefined)
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      status: "active",
      summary: quest.summary,
      obligationLevel: quest.obligationLevel,
    }));
}

export function createInitState(config: StageConfig): StageInitState {
  return EMPTY_INIT_STATE(config);
}

export function createChatState(existing: StageChatState | null): StageChatState {
  return existing ?? { ...DEFAULT_CHAT_STATE };
}

export function createInitialMessageState(initState: StageInitState): StageMessageState {
  const roleStart =
    initState.roleStarts.find((candidate) => candidate.id === initState.config.startRole) ?? initState.roleStarts[0];
  const startLocation = initState.mapDef.locations.find((location) => location.id === roleStart.startLocationId);
  if (!startLocation) {
    throw new Error(`Unknown start location: ${roleStart.startLocationId}`);
  }

  const initialState = EMPTY_MESSAGE_STATE();
  initialState.clock = buildClockState(
    DEFAULT_START_CLOCK.year,
    DEFAULT_START_CLOCK.month,
    DEFAULT_START_CLOCK.day,
    DEFAULT_START_CLOCK.hour,
    DEFAULT_START_CLOCK.minute,
    initState.worldDef.calendarDef,
  );
  initialState.player = {
    ...initialState.player,
    roleBackground: roleStart.id,
    locationId: startLocation.id,
    regionId: startLocation.regionId,
    money: copperToWallet(roleStart.startingMoneyInCopper, initState),
    activeQuests: buildInitialQuests(initState, roleStart.startingQuestIds),
    reputation: {
      "aihalid-guild": roleStart.id === "caravan-hand" ? 10 : 0,
      "eter-royal-magic-academy": roleStart.id === "academy-hopeful" ? 8 : 0,
      "gursa-treaty-council": roleStart.id === "minor-noble-exile" ? -5 : 0,
      "brotherhood-golden-sun": -10,
      "ardanthal-crown": roleStart.id === "minor-noble-exile" ? 5 : 0,
    },
  };

  let inventory = initialState.player.inventory;
  for (const entry of roleStart.starterItemIds) {
    inventory = addInventoryItem(inventory, entry.itemId, entry.quantity, initState.itemCatalog);
  }
  initialState.player.inventory = inventory;

  initialState.world.weatherByRegion = buildInitialWeather(initState, initialState.clock);
  initialState.world.routeConditions = recalculateRouteConditions(initState, initialState);
  initialState.world.dynamicEvents = buildInitialEvents(initState, initialState.clock.totalMinutes);
  initialState.world.localRumors = buildLocalRumors(initState, initialState);
  initialState.world.settlementStates = Object.fromEntries(
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
  initialState.world.localActors = Object.fromEntries(
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
  initialState.ui.mapFocusLocationId = startLocation.id;
  initialState.ui.lastEngineNote = `Reincarnated as ${roleStart.label.toLowerCase()} near ${startLocation.name}.`;

  return synchronizeAll(initState, initialState);
}

export function hydrateState(
  initState: StageInitState,
  messageState: StageMessageState | null,
  chatState: StageChatState | null,
): { messageState: StageMessageState; chatState: StageChatState } {
  const nextMessageState = synchronizeAll(initState, messageState ?? createInitialMessageState(initState));
  const nextChatState = markExploration(initState, nextMessageState, createChatState(chatState));
  return {
    messageState: nextMessageState,
    chatState: nextChatState,
  };
}
