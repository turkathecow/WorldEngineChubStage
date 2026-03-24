import { copperToWallet } from "./economy";
import { addInventoryItem } from "./inventory";
import {
  DashboardViewModel,
  QuestState,
  SpawnCandidate,
  StageChatState,
  StageInitState,
  StageMessageState,
  StartRoleId,
} from "./types";

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractLabeledChoice(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(?:is|=|:|-)?\\s*([^,.;\\n]+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return capitalizeWords(match[1]);
    }
  }
  return undefined;
}

function inferGender(text: string): string | undefined {
  if (/\b(nonbinary|non-binary|androgynous)\b/i.test(text)) {
    return "Nonbinary";
  }
  if (/\b(female|woman|girl|lady)\b/i.test(text)) {
    return "Female";
  }
  if (/\b(male|man|boy|gentleman)\b/i.test(text)) {
    return "Male";
  }
  return extractLabeledChoice(text, ["gender", "sex"]);
}

function inferRace(text: string): string | undefined {
  const raceMatches = [
    "half elf",
    "half-elf",
    "beastkin",
    "demi human",
    "demi-human",
    "dragonkin",
    "merfolk",
    "vampire",
    "dwarf",
    "human",
    "elf",
    "demon",
    "oni",
  ];
  const normalized = normalizeText(text);
  const match = raceMatches.find((race) => normalized.includes(race.replace(/[^a-z0-9\s-]/g, " ")));
  return match ? capitalizeWords(match.replace(/-/g, " ")) : extractLabeledChoice(text, ["race", "species"]);
}

function inferAppearance(text: string): string | undefined {
  return extractLabeledChoice(text, ["appearance", "looks like", "look like"]);
}

function inferFamily(text: string): string | undefined {
  const normalized = normalizeText(text);
  if (/\b(noble|baron|count|duke|house|exile)\b/i.test(text)) {
    return "Noble family";
  }
  if (normalized.includes("merchant") || normalized.includes("trader")) {
    return "Merchant family";
  }
  if (normalized.includes("caravan")) {
    return "Caravan family";
  }
  if (normalized.includes("orphan")) {
    return "Orphaned upbringing";
  }
  if (normalized.includes("scholar") || normalized.includes("academy") || normalized.includes("mage")) {
    return "Scholarly household";
  }
  if (normalized.includes("sailor") || normalized.includes("fisher") || normalized.includes("seafar")) {
    return "Seafaring family";
  }
  if (normalized.includes("farmer") || normalized.includes("villager") || normalized.includes("commoner")) {
    return "Common family";
  }
  return extractLabeledChoice(text, ["family", "background", "household", "social class", "class"]);
}

function inferRoleId(text: string): StartRoleId | undefined {
  const normalized = normalizeText(text);
  if (normalized.includes("academy") || normalized.includes("student") || normalized.includes("hopeful")) {
    return "academy-hopeful";
  }
  if (normalized.includes("caravan") || normalized.includes("merchant guard") || normalized.includes("teamster")) {
    return "caravan-hand";
  }
  if (normalized.includes("castaway") || normalized.includes("shipwreck") || normalized.includes("washed ashore")) {
    return "castaway";
  }
  if (normalized.includes("noble") || normalized.includes("exile")) {
    return "minor-noble-exile";
  }
  if (normalized.includes("wanderer") || normalized.includes("commoner") || normalized.includes("villager")) {
    return "reborn-wanderer";
  }
  return undefined;
}

function inferRegionId(initState: StageInitState, text: string): string | undefined {
  const normalized = normalizeText(text);
  return initState.mapDef.regions.find((region) => {
    const regionName = normalizeText(region.name);
    const regionId = normalizeText(region.id.replace(/-/g, " "));
    return normalized.includes(regionName) || normalized.includes(regionId);
  })?.id;
}

function inferLocationId(initState: StageInitState, text: string): string | undefined {
  const normalized = normalizeText(text);
  return initState.mapDef.locations.find((location) => {
    const locationName = normalizeText(location.name);
    const locationId = normalizeText(location.id.replace(/-/g, " "));
    return normalized.includes(locationName) || normalized.includes(locationId);
  })?.id;
}

function deriveConfidence(candidate: SpawnCandidate | null): number {
  if (!candidate) {
    return 0;
  }
  let score = 0;
  if (candidate.chosenGender) {
    score += 0.1;
  }
  if (candidate.chosenRace) {
    score += 0.15;
  }
  if (candidate.chosenAppearance) {
    score += 0.1;
  }
  if (candidate.chosenFamily) {
    score += 0.2;
  }
  if (candidate.chosenRole) {
    score += 0.25;
  }
  if (candidate.chosenRegionId) {
    score += 0.1;
  }
  if (candidate.chosenLocationId) {
    score += 0.25;
  }
  return Number(Math.min(1, score).toFixed(2));
}

function hasAnySpawnChoice(candidate: SpawnCandidate | null): boolean {
  if (!candidate) {
    return false;
  }
  return Object.entries(candidate).some(([key, value]) => key !== "confidence" && Boolean(value));
}

function deriveRoleFromFamily(candidate: SpawnCandidate | null): StartRoleId | null {
  if (!candidate) {
    return null;
  }
  if (candidate.chosenRole) {
    return candidate.chosenRole;
  }
  const family = normalizeText(candidate.chosenFamily ?? "");
  if (family.includes("noble")) {
    return "minor-noble-exile";
  }
  if (family.includes("caravan") || family.includes("merchant")) {
    return "caravan-hand";
  }
  if (family.includes("scholarly") || family.includes("academy")) {
    return "academy-hopeful";
  }
  if (family.includes("seafaring")) {
    return "castaway";
  }
  if (family.includes("common") || family.includes("orphan")) {
    return "reborn-wanderer";
  }
  return null;
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

function buildStartingReputation(roleId: StartRoleId): Record<string, number> {
  return {
    "aihalid-guild": roleId === "caravan-hand" ? 10 : 0,
    "eter-royal-magic-academy": roleId === "academy-hopeful" ? 8 : 0,
    "gursa-treaty-council": roleId === "minor-noble-exile" ? -5 : 0,
    "brotherhood-golden-sun": -10,
    "ardanthal-crown": roleId === "minor-noble-exile" ? 5 : 0,
  };
}

function buildPendingNote(candidate: SpawnCandidate | null): string {
  if (!candidate || !hasAnySpawnChoice(candidate)) {
    return "Incarnation not yet resolved. Waiting for chat-established choices or narrative confirmation before assigning location, family, inventory, and local conditions.";
  }
  const missing: string[] = [];
  if (!candidate.chosenFamily && !candidate.chosenRole) {
    missing.push("family or starting background");
  }
  if (!candidate.chosenLocationId) {
    missing.push("specific starting location");
  }
  if (missing.length === 0) {
    return "Incarnation choices are partially grounded and ready for final narrative confirmation.";
  }
  return `Incarnation partially resolved. Still waiting on ${missing.join(" and ")} before local state can be finalized.`;
}

function cloneMessageState(messageState: StageMessageState): StageMessageState {
  return JSON.parse(JSON.stringify(messageState)) as StageMessageState;
}

export function isSpawnedState(messageState: StageMessageState): boolean {
  return messageState.incarnationPhase === "spawned" && Boolean(messageState.player.locationId && messageState.player.regionId);
}

export function createUnresolvedPlayerState(): StageMessageState["player"] {
  return {
    roleBackground: null,
    locationId: null,
    regionId: null,
    sublocation: null,
    money: null,
    inventory: [],
    injuries: [],
    fatigue: null,
    reputation: {},
    activeQuests: [],
    party: [],
  };
}

export function deriveSpawnCandidateFromText(initState: StageInitState, text: string): SpawnCandidate | null {
  const chosenLocationId = inferLocationId(initState, text);
  const chosenRegionId =
    (chosenLocationId
      ? initState.mapDef.locations.find((location) => location.id === chosenLocationId)?.regionId
      : undefined) ?? inferRegionId(initState, text);

  const candidate: SpawnCandidate = {
    chosenGender: inferGender(text),
    chosenRace: inferRace(text),
    chosenAppearance: inferAppearance(text),
    chosenFamily: inferFamily(text),
    chosenRole: inferRoleId(text),
    chosenLocationText: chosenLocationId
      ? initState.mapDef.locations.find((location) => location.id === chosenLocationId)?.name
      : extractLabeledChoice(text, ["location", "starting point", "spawn", "birthplace"]),
    chosenRegionId,
    chosenLocationId,
  };

  if (!hasAnySpawnChoice(candidate)) {
    return null;
  }

  return {
    ...candidate,
    confidence: deriveConfidence(candidate),
  };
}

export function deriveSpawnCandidateFromConversation(initState: StageInitState, messages: string[]): SpawnCandidate | null {
  return messages.reduce<SpawnCandidate | null>((combined, text) => mergeSpawnCandidate(combined, deriveSpawnCandidateFromText(initState, text)), null);
}

export function mergeSpawnCandidate(existing: SpawnCandidate | null, incoming: SpawnCandidate | null): SpawnCandidate | null {
  if (!existing && !incoming) {
    return null;
  }
  const merged: SpawnCandidate = {
    ...(existing ?? {}),
    ...(incoming ?? {}),
  };
  merged.chosenRole = merged.chosenRole ?? deriveRoleFromFamily(merged) ?? undefined;
  if (merged.chosenLocationId && !merged.chosenRegionId) {
    merged.chosenRegionId = undefined;
  }
  merged.confidence = deriveConfidence(merged);
  return merged;
}

export function canFinalizeSpawn(candidate: SpawnCandidate | null): boolean {
  return Boolean(candidate?.chosenLocationId && (candidate.chosenRole ?? deriveRoleFromFamily(candidate)));
}

export function finalizeSpawn(
  initState: StageInitState,
  messageState: StageMessageState,
  spawnCandidate: SpawnCandidate,
): StageMessageState {
  const resolvedRoleId = spawnCandidate.chosenRole ?? deriveRoleFromFamily(spawnCandidate);
  if (!spawnCandidate.chosenLocationId || !resolvedRoleId) {
    return messageState;
  }

  const roleStart = initState.roleStarts.find((candidate) => candidate.id === resolvedRoleId);
  const location = initState.mapDef.locations.find((candidate) => candidate.id === spawnCandidate.chosenLocationId);
  if (!roleStart || !location) {
    return messageState;
  }

  let inventory = [] as StageMessageState["player"]["inventory"];
  for (const entry of roleStart.starterItemIds) {
    inventory = addInventoryItem(inventory, entry.itemId, entry.quantity, initState.itemCatalog);
  }

  const nextState = cloneMessageState(messageState);
  nextState.incarnationPhase = "spawned";
  nextState.spawnCandidate = {
    ...spawnCandidate,
    chosenRole: resolvedRoleId,
    chosenLocationId: location.id,
    chosenRegionId: location.regionId,
    chosenLocationText: location.name,
    confidence: deriveConfidence({
      ...spawnCandidate,
      chosenRole: resolvedRoleId,
      chosenLocationId: location.id,
      chosenRegionId: location.regionId,
      chosenLocationText: location.name,
    }),
  };
  nextState.player = {
    ...nextState.player,
    roleBackground: resolvedRoleId,
    locationId: location.id,
    regionId: location.regionId,
    sublocation: null,
    money: copperToWallet(roleStart.startingMoneyInCopper, initState),
    inventory,
    injuries: [],
    fatigue: {
      value: 10,
      band: "fresh",
    },
    reputation: buildStartingReputation(resolvedRoleId),
    activeQuests: buildInitialQuests(initState, roleStart.startingQuestIds),
  };
  nextState.ui.mapFocusLocationId = location.id;
  nextState.ui.lastEngineNote = `Incarnation resolved at ${location.name}. Local simulation is now grounded.`;
  return nextState;
}

function buildChoiceEntries(initState: StageInitState, candidate: SpawnCandidate | null): DashboardViewModel["location"]["knownChoices"] {
  if (!candidate) {
    return [];
  }
  const roleLabel = candidate.chosenRole
    ? initState.roleStarts.find((role) => role.id === candidate.chosenRole)?.label ?? candidate.chosenRole
    : null;
  const locationName =
    (candidate.chosenLocationId
      ? initState.mapDef.locations.find((location) => location.id === candidate.chosenLocationId)?.name
      : null) ??
    candidate.chosenLocationText;
  const regionName = candidate.chosenRegionId
    ? initState.mapDef.regions.find((region) => region.id === candidate.chosenRegionId)?.name ?? candidate.chosenRegionId
    : null;

  return [
    candidate.chosenGender ? { label: "Gender", value: candidate.chosenGender } : null,
    candidate.chosenRace ? { label: "Race", value: candidate.chosenRace } : null,
    candidate.chosenAppearance ? { label: "Appearance", value: candidate.chosenAppearance } : null,
    candidate.chosenFamily ? { label: "Family", value: candidate.chosenFamily } : null,
    roleLabel ? { label: "Role", value: roleLabel } : null,
    locationName ? { label: "Location", value: locationName } : null,
    regionName && regionName !== locationName ? { label: "Region", value: regionName } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function botEstablishesIncarnationOutcome(text: string): boolean {
  return /\b(you awaken|you wake|you open your eyes|reborn|reincarnated|born into|born as|you are now|you find yourself in)\b/i.test(text);
}

function applySpawnCandidate(
  initState: StageInitState,
  messageState: StageMessageState,
  candidate: SpawnCandidate | null,
): StageMessageState {
  const mergedCandidate = mergeSpawnCandidate(messageState.spawnCandidate, candidate);
  const nextState = cloneMessageState(messageState);
  nextState.spawnCandidate = mergedCandidate;
  nextState.incarnationPhase = hasAnySpawnChoice(mergedCandidate) ? "resolving" : "unresolved";
  nextState.ui.lastEngineNote = buildPendingNote(mergedCandidate);

  if (canFinalizeSpawn(mergedCandidate)) {
    return finalizeSpawn(initState, nextState, mergedCandidate!);
  }

  return nextState;
}

export function applySpawnResolutionFromUserInput(
  initState: StageInitState,
  messageState: StageMessageState,
  rawText: string,
): StageMessageState {
  const candidate = mergeSpawnCandidate(
    deriveSpawnCandidateFromConversation(initState, [rawText]),
    deriveSpawnCandidateFromText(initState, rawText),
  );
  return applySpawnCandidate(initState, messageState, candidate);
}

export function applySpawnResolutionFromBotText(
  initState: StageInitState,
  messageState: StageMessageState,
  rawText: string,
): StageMessageState {
  if (!botEstablishesIncarnationOutcome(rawText)) {
    return messageState;
  }
  return applySpawnCandidate(initState, messageState, deriveSpawnCandidateFromText(initState, rawText));
}

export function buildIncarnationNote(messageState: StageMessageState): string {
  if (isSpawnedState(messageState)) {
    return "Incarnation resolved. Deterministic local state is active.";
  }
  return buildPendingNote(messageState.spawnCandidate);
}

export function buildKnownSpawnChoices(initState: StageInitState, messageState: StageMessageState): DashboardViewModel["location"]["knownChoices"] {
  return buildChoiceEntries(initState, messageState.spawnCandidate);
}

export function maybeMarkExplorationForSpawn(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
): StageChatState {
  if (!isSpawnedState(messageState) || !messageState.player.locationId) {
    return chatState;
  }
  const location = initState.mapDef.locations.find((candidate) => candidate.id === messageState.player.locationId);
  if (!location) {
    return chatState;
  }
  return {
    ...chatState,
    exploredLocations: chatState.exploredLocations.includes(location.id)
      ? chatState.exploredLocations
      : [...chatState.exploredLocations, location.id],
    discoveredLoreEntries: chatState.discoveredLoreEntries.includes(location.codexEntryId)
      ? chatState.discoveredLoreEntries
      : [...chatState.discoveredLoreEntries, location.codexEntryId],
  };
}
