import { advanceClock } from "./clock";
import { adjustFatigue, maybeAddTravelStrain, recoverFatigue, recoverMinorInjuries } from "./conditions";
import { canAfford, formatMoney, subtractMoney, addMoney } from "./economy";
import { buildLocalRumors, advanceEvents } from "./events";
import { adjustReputation } from "./factions";
import { addInventoryItem, countInventoryItem, removeInventoryItem } from "./inventory";
import { buildEngineNote, markExploration, synchronizeAll } from "./reducers";
import { getLocation } from "./selectors";
import { computeTravelMinutes, getAdjacentRoutes, getOtherRouteEnd, getRouteByLocations, recalculateRouteConditions } from "./travel";
import { advanceWeather } from "./weather";
import {
  ActionCategory,
  ActionIntent,
  ActionResolution,
  DashboardPanel,
  ItemDef,
  LocalActorState,
  RouteDef,
  ShopAction,
  StageChatState,
  StageInitState,
  StageMessageState,
} from "./types";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function extractQuantity(text: string): number {
  const numeric = text.match(/\b(\d+)\b/);
  if (numeric) {
    return Math.max(1, Number(numeric[1]));
  }
  for (const [label, value] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(label)) {
      return value;
    }
  }
  return 1;
}

function findItemMention(text: string, itemCatalog: ItemDef[]): string | null {
  return (
    itemCatalog.find((item) => {
      const haystack = normalize(`${item.id} ${item.name}`);
      return haystack.split(/\s+/).every((token) => !token || !text.includes(token))
        ? text.includes(item.id.replace(/-/g, " "))
        : text.includes(item.name.toLowerCase()) || text.includes(item.id.replace(/-/g, " "));
    })?.id ?? null
  );
}

function findLocationMention(initState: StageInitState, text: string): string | null {
  const normalized = normalize(text);
  return (
    initState.mapDef.locations.find((location) => {
      const locationName = normalize(location.name);
      const locationId = normalize(location.id.replace(/-/g, " "));
      return normalized.includes(locationName) || normalized.includes(locationId);
    })?.id ?? null
  );
}

function findSublocation(text: string): string | null {
  const normalized = normalize(text);
  const options = ["inn", "market", "docks", "tower", "guild hall", "camp", "library"];
  return options.find((candidate) => normalized.includes(candidate)) ?? null;
}

function inferPanel(text: string): DashboardPanel | null {
  const normalized = normalize(text);
  if (normalized.includes("inventory") || normalized.includes("bag") || normalized.includes("pack")) {
    return "inventory";
  }
  if (normalized.includes("status") || normalized.includes("condition") || normalized.includes("health")) {
    return "status";
  }
  if (normalized.includes("map") || normalized.includes("route") || normalized.includes("travel")) {
    return "map";
  }
  if (normalized.includes("quest") || normalized.includes("obligation")) {
    return "quests";
  }
  if (normalized.includes("reputation") || normalized.includes("standing") || normalized.includes("faction")) {
    return "reputation";
  }
  return null;
}

function isWaitIntent(text: string): boolean {
  return /\b(wait|rest|sleep|camp|nap|pause)\b/.test(text);
}

function isTravelIntent(text: string): boolean {
  return /\b(go|travel|head|walk|ride|sail|leave|journey|move|enter)\b/.test(text);
}

function isInspectIntent(text: string): boolean {
  return /\b(check|inspect|show|look at|open|review)\b/.test(text);
}

function isShopIntent(text: string): boolean {
  return /\b(buy|purchase|sell|trade)\b/.test(text);
}

function isTalkIntent(text: string): boolean {
  return /\b(talk|speak|ask|approach|greet)\b/.test(text);
}

function inferShopAction(text: string): ShopAction | null {
  if (/\b(buy|purchase)\b/.test(text)) {
    return "buy";
  }
  if (/\b(sell|trade)\b/.test(text)) {
    return "sell";
  }
  return null;
}

export function resolveActionIntent(initState: StageInitState, messageState: StageMessageState, rawText: string): ActionIntent {
  const text = normalize(rawText);
  const mentionedLocation = findLocationMention(initState, text);
  const mentionedItem = findItemMention(text, initState.itemCatalog);
  const selectedPanel = inferPanel(text);
  const sublocation = findSublocation(text);
  const quantity = extractQuantity(text);

  let category: ActionCategory = "fallback";
  if (isWaitIntent(text)) {
    category = "wait";
  } else if (isShopIntent(text)) {
    category = "shop";
  } else if (isInspectIntent(text)) {
    category = "inspect";
  } else if (isTalkIntent(text)) {
    category = "talk";
  } else if (isTravelIntent(text) && mentionedLocation && mentionedLocation !== messageState.player.locationId) {
    category = "travel";
  } else if (isTravelIntent(text) && sublocation) {
    category = "enter";
  }

  return {
    category,
    targetLocationId: mentionedLocation,
    targetItemId: mentionedItem,
    shopAction: inferShopAction(text),
    quantity,
    selectedPanel,
    sublocation,
    rawText,
  };
}

function cloneMessageState(messageState: StageMessageState): StageMessageState {
  return JSON.parse(JSON.stringify(messageState)) as StageMessageState;
}

function refreshWorld(initState: StageInitState, messageState: StageMessageState): StageMessageState {
  const next = cloneMessageState(messageState);
  next.world.weatherByRegion = advanceWeather(initState, next);
  next.world.routeConditions = recalculateRouteConditions(initState, next);
  next.world.dynamicEvents = advanceEvents(initState, next);
  next.world.localRumors = buildLocalRumors(initState, next);
  return next;
}

function advanceWorldTime(initState: StageInitState, messageState: StageMessageState, minutes: number): StageMessageState {
  const next = cloneMessageState(messageState);
  next.clock = advanceClock(next.clock, minutes, initState.worldDef.calendarDef);
  return refreshWorld(initState, next);
}

function buildBlockedResolution(
  messageState: StageMessageState,
  chatState: StageChatState,
  category: ActionCategory,
  label: string,
  detail: string,
): ActionResolution {
  const nextState = {
    ...messageState,
    scene: {
      ...messageState.scene,
      lastResolvedAction: {
        category,
        label,
        timeAdvancedMinutes: 0,
        blocked: true,
        details: [detail],
        destinationLocationId: null,
        touchedSystems: [],
      },
    },
    ui: {
      ...messageState.ui,
      lastEngineNote: detail,
    },
  };
  return {
    messageState: nextState,
    chatState,
    action: nextState.scene.lastResolvedAction!,
  };
}

function talkTargetEffect(
  nextState: StageMessageState,
  currentActors: LocalActorState[],
  text: string,
): StageMessageState {
  const lowered = normalize(text);
  const actor = currentActors.find((candidate) => lowered.includes(normalize(candidate.name)) || lowered.includes(normalize(candidate.role)));
  if (!actor) {
    return nextState;
  }

  let reputation = nextState.player.reputation;
  if (actor.factionId) {
    reputation = adjustReputation(reputation, actor.factionId, actor.disposition === "friendly" ? 2 : 1);
  }

  return {
    ...nextState,
    player: {
      ...nextState.player,
      reputation,
    },
  };
}

function resolveWait(initState: StageInitState, messageState: StageMessageState, chatState: StageChatState, rawText: string): ActionResolution {
  const text = normalize(rawText);
  const minutes = text.includes("sleep") ? 480 : text.includes("rest") ? 180 : 60;
  let nextState = advanceWorldTime(initState, messageState, minutes);
  nextState.player.fatigue = recoverFatigue(nextState.player.fatigue, minutes);
  nextState.player.injuries = recoverMinorInjuries(nextState.player.injuries, minutes);
  nextState.ui.lastEngineNote = `Time passes quietly for ${minutes} minutes.`;
  nextState.scene.lastResolvedAction = {
    category: "wait",
    label: text.includes("sleep") ? "Rested" : "Waited",
    timeAdvancedMinutes: minutes,
    blocked: false,
    details: [`Recovered some fatigue and let the world progress.`],
    destinationLocationId: null,
    touchedSystems: ["clock", "weather", "fatigue"],
  };
  const nextChatState = markExploration(initState, nextState, chatState);
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState: nextChatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveTravel(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  targetLocationId: string | null,
): ActionResolution {
  if (!targetLocationId) {
    return buildBlockedResolution(messageState, chatState, "travel", "Travel failed", "No known destination was recognized.");
  }

  const route = getRouteByLocations(initState, messageState.player.locationId, targetLocationId);
  if (!route) {
    return buildBlockedResolution(
      messageState,
      chatState,
      "travel",
      "Travel blocked",
      "Only adjacent known locations can be traveled to deterministically in v1.",
    );
  }

  const routeCondition = messageState.world.routeConditions[route.id];
  if (routeCondition.blocked) {
    return buildBlockedResolution(
      messageState,
      chatState,
      "travel",
      "Travel blocked",
      `${routeCondition.statusLabel} conditions make this route unsafe to commit to right now.`,
    );
  }

  const destination = getLocation(initState, targetLocationId);
  const minutes = computeTravelMinutes(initState, route, routeCondition, messageState.player.fatigue.value);
  let nextState = advanceWorldTime(initState, messageState, minutes);
  const travelFatigue =
    Math.ceil((minutes / 60) * initState.worldDef.travelModelDef.fatiguePerTravelHour) +
    route.difficulty +
    (routeCondition.danger >= 7 ? initState.worldDef.travelModelDef.difficultRouteFatigueBonus : 0);

  nextState.player.locationId = destination.id;
  nextState.player.regionId = destination.regionId;
  nextState.player.sublocation = null;
  nextState.player.fatigue = adjustFatigue(nextState.player.fatigue, travelFatigue);
  nextState.player.injuries = maybeAddTravelStrain(
    nextState.player.injuries,
    nextState.player.fatigue,
    initState.config.injuryRealism,
  );
  nextState.ui.selectedPanel = "map";
  nextState.ui.mapFocusLocationId = destination.id;
  nextState.ui.lastEngineNote = `Arrived at ${destination.name} after ${Math.floor(minutes / 60)}h ${minutes % 60}m.`;
  nextState.scene.lastResolvedAction = {
    category: "travel",
    label: `Traveled to ${destination.name}`,
    timeAdvancedMinutes: minutes,
    blocked: false,
    details: [
      route.notes,
      `Route conditions: ${routeCondition.statusLabel}`,
      `Travel cost: ${formatMoney(messageState.player.money)}`,
    ],
    destinationLocationId: destination.id,
    touchedSystems: ["clock", "weather", "travel", "fatigue", "map"],
  };
  const nextChatState = markExploration(initState, nextState, chatState);
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState: nextChatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveInspect(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  panel: DashboardPanel | null,
): ActionResolution {
  const nextState = cloneMessageState(messageState);
  nextState.ui.selectedPanel = panel ?? "overview";
  nextState.ui.lastEngineNote = `Reviewed ${panel ?? "overview"} without advancing the simulation clock.`;
  nextState.scene.lastResolvedAction = {
    category: "inspect",
    label: `Inspected ${panel ?? "overview"}`,
    timeAdvancedMinutes: 0,
    blocked: false,
    details: ["Pure inspection did not change deterministic world state."],
    destinationLocationId: null,
    touchedSystems: ["ui"],
  };
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveShop(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  itemId: string | null,
  quantity: number,
  shopAction: ShopAction | null,
): ActionResolution {
  const location = getLocation(initState, messageState.player.locationId);
  if (!location.market) {
    return buildBlockedResolution(messageState, chatState, "shop", "Trade blocked", "There is no reliable market here.");
  }
  if (!itemId || !shopAction) {
    return buildBlockedResolution(messageState, chatState, "shop", "Trade blocked", "The item or trade intent could not be resolved.");
  }

  const item = initState.itemCatalog.find((candidate) => candidate.id === itemId);
  if (!item) {
    return buildBlockedResolution(messageState, chatState, "shop", "Trade blocked", "That item is not part of the current item catalog.");
  }

  let nextState = cloneMessageState(messageState);
  const totalCost = item.baseValueInCopper * quantity;

  if (shopAction === "buy") {
    if (!canAfford(nextState.player.money, totalCost, initState)) {
      return buildBlockedResolution(
        messageState,
        chatState,
        "shop",
        "Purchase failed",
        `You need ${totalCost} copper to buy ${quantity} ${item.name}.`,
      );
    }
    const nextWallet = subtractMoney(nextState.player.money, totalCost, initState);
    if (!nextWallet) {
      return buildBlockedResolution(messageState, chatState, "shop", "Purchase failed", "Money conversion failed.");
    }
    nextState.player.money = nextWallet;
    nextState.player.inventory = addInventoryItem(nextState.player.inventory, item.id, quantity, initState.itemCatalog);
  } else {
    if (countInventoryItem(nextState.player.inventory, item.id) < quantity) {
      return buildBlockedResolution(
        messageState,
        chatState,
        "shop",
        "Sale failed",
        `You do not have ${quantity} ${item.name} to sell.`,
      );
    }
    const nextInventory = removeInventoryItem(nextState.player.inventory, item.id, quantity);
    if (!nextInventory) {
      return buildBlockedResolution(messageState, chatState, "shop", "Sale failed", "Inventory update failed.");
    }
    nextState.player.inventory = nextInventory;
    nextState.player.money = addMoney(nextState.player.money, Math.floor(totalCost * 0.5), initState);
  }

  nextState = advanceWorldTime(initState, nextState, 15);
  nextState.ui.selectedPanel = "inventory";
  nextState.ui.lastEngineNote = `${shopAction === "buy" ? "Bought" : "Sold"} ${quantity} ${item.name}.`;
  nextState.scene.lastResolvedAction = {
    category: "shop",
    label: `${shopAction === "buy" ? "Bought" : "Sold"} ${item.name}`,
    timeAdvancedMinutes: 15,
    blocked: false,
    details: [`Market action resolved at ${location.name}.`],
    destinationLocationId: null,
    touchedSystems: ["inventory", "money", "clock"],
  };

  return {
    messageState: synchronizeAll(initState, nextState),
    chatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveTalk(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  rawText: string,
): ActionResolution {
  const currentActors = messageState.world.localActors[messageState.player.locationId] ?? [];
  let nextState = advanceWorldTime(initState, messageState, 10);
  nextState = talkTargetEffect(nextState, currentActors, rawText);
  nextState.ui.lastEngineNote = currentActors.length > 0 ? "Opened conversation with a local contact." : "Attempted to engage the local scene.";
  nextState.scene.lastResolvedAction = {
    category: "talk",
    label: "Spoke with locals",
    timeAdvancedMinutes: 10,
    blocked: false,
    details: ["Conversation was left to the model, but faction standing can shift in bounded ways."],
    destinationLocationId: null,
    touchedSystems: ["clock", "reputation"],
  };
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveEnter(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  sublocation: string | null,
): ActionResolution {
  if (!sublocation) {
    return buildBlockedResolution(messageState, chatState, "enter", "Enter blocked", "No local sublocation was recognized.");
  }
  const nextState = advanceWorldTime(initState, messageState, 10);
  nextState.player.sublocation = sublocation;
  nextState.ui.lastEngineNote = `Shifted focus to the ${sublocation}.`;
  nextState.scene.lastResolvedAction = {
    category: "enter",
    label: `Entered ${sublocation}`,
    timeAdvancedMinutes: 10,
    blocked: false,
    details: ["This changed immediate scene framing without altering map position."],
    destinationLocationId: null,
    touchedSystems: ["clock", "scene"],
  };
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState,
    action: nextState.scene.lastResolvedAction,
  };
}

function resolveFallback(initState: StageInitState, messageState: StageMessageState, chatState: StageChatState): ActionResolution {
  const nextState = advanceWorldTime(initState, messageState, 5);
  nextState.ui.lastEngineNote = buildEngineNote(initState, nextState, chatState);
  nextState.scene.lastResolvedAction = {
    category: "fallback",
    label: "Scene continued",
    timeAdvancedMinutes: 5,
    blocked: false,
    details: ["No deterministic action matched cleanly; only light time passage applied."],
    destinationLocationId: null,
    touchedSystems: ["clock"],
  };
  return {
    messageState: synchronizeAll(initState, nextState),
    chatState,
    action: nextState.scene.lastResolvedAction,
  };
}

export function resolveUserTurn(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
  rawText: string,
): ActionResolution {
  const intent = resolveActionIntent(initState, messageState, rawText);
  const currentState = synchronizeAll(initState, messageState);

  switch (intent.category) {
    case "wait":
      return resolveWait(initState, currentState, chatState, rawText);
    case "travel":
      return resolveTravel(initState, currentState, chatState, intent.targetLocationId);
    case "inspect":
      return resolveInspect(initState, currentState, chatState, intent.selectedPanel);
    case "shop":
      return resolveShop(initState, currentState, chatState, intent.targetItemId, intent.quantity, intent.shopAction);
    case "talk":
      return resolveTalk(initState, currentState, chatState, rawText);
    case "enter":
      return resolveEnter(initState, currentState, chatState, intent.sublocation);
    default:
      return resolveFallback(initState, currentState, chatState);
  }
}
