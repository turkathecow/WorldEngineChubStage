import { formatDate, formatTime } from "./clock";
import { formatMoney } from "./economy";
import { formatInventoryHighlights } from "./inventory";
import { buildStructuredOutputInstruction } from "./llmStructuredState";
import { buildDashboardViewModel, getLocation } from "./selectors";
import { buildIncarnationNote, isSpawnedState } from "./spawnResolution";
import { StageChatState, StageInitState, StageMessageState } from "./types";

export function buildPromptBridge(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
): string {
  const view = buildDashboardViewModel(initState, messageState, chatState);
  const structuredOutputInstruction = buildStructuredOutputInstruction();

  if (!isSpawnedState(messageState) || !messageState.player.locationId || !messageState.player.regionId) {
    const knownChoices =
      view.location.knownChoices.length > 0
        ? view.location.knownChoices.map((entry) => `${entry.label}: ${entry.value}`).join("; ")
        : "none grounded yet";
    return [
      "Engine State:",
      `- Incarnation Phase: ${messageState.incarnationPhase}`,
      `- Date: ${formatDate(messageState.clock, initState.worldDef.calendarDef)}`,
      `- Time: ${formatTime(messageState.clock)}`,
      `- Season: ${messageState.clock.season}`,
      `- Player Location: unresolved`,
      `- Family / Background: ${messageState.spawnCandidate?.chosenFamily ?? messageState.spawnCandidate?.chosenRole ?? "unresolved"}`,
      `- Known Spawn Choices: ${knownChoices}`,
      "- Inventory: not assigned",
      "- Reputation: not assigned",
      "- Local Conditions: unresolved until spawn is established",
      `- Engine Note: ${buildIncarnationNote(messageState)}`,
      "- Hard Constraints: do not invent a concrete starting settlement, inventory, weather, money, route state, or faction standing until the chat establishes them.",
      "Treat unresolved fields as genuinely pending. Prefer asking for or respecting explicit reincarnation choices over fabricating local facts.",
      `Structured Output: ${structuredOutputInstruction}`,
    ].join("\n");
  }

  const location = getLocation(initState, messageState.player.locationId);
  const currentWeather = messageState.world.weatherByRegion[messageState.player.regionId];
  const localRumors = messageState.world.localRumors[location.id] ?? [];
  const inventory = formatInventoryHighlights(messageState.player.inventory, initState.itemCatalog);
  const nearbyActors = messageState.scene.visibleActors.length > 0 ? messageState.scene.visibleActors.join(", ") : "none immediate";
  const hazards = messageState.scene.immediateHazards.length > 0 ? messageState.scene.immediateHazards.join(", ") : "none immediate";
  const obligations =
    messageState.player.activeQuests.filter((quest) => quest.status === "active").map((quest) => quest.title).join(", ") ||
    "none active";
  const tensions = [
    messageState.world.settlementStates[location.id]?.notableIssue,
    localRumors[0] ?? null,
  ]
    .filter((entry): entry is string => entry !== null)
    .join(" | ") || "no special local tension";

  return [
    "Engine State:",
    `- Date: ${formatDate(messageState.clock, initState.worldDef.calendarDef)}`,
    `- Time: ${formatTime(messageState.clock)}`,
    `- Season: ${messageState.clock.season}`,
    `- Location: ${view.topLine.location}`,
    `- Region: ${view.topLine.region} (${view.location.continent})`,
    `- Weather: ${view.weather.conditionLabel}, ${view.weather.temperatureLabel}${currentWeather.activeEvent ? `, event: ${currentWeather.activeEvent.label}` : ""}`,
    `- Travel Conditions: ${view.location.connectedRoutes.map((route) => `${route.destinationName} ${route.statusLabel}`).join("; ") || "no direct routes"}`,
    `- Player Condition: fatigue ${view.status.fatigueLabel}; injuries ${view.status.injuries.join(", ") || "none"}`,
    `- Money: ${messageState.player.money ? formatMoney(messageState.player.money) : "not assigned"}`,
    `- Inventory Highlights: ${inventory.join(", ") || "none notable"}`,
    `- Nearby Actors: ${nearbyActors}`,
    `- Nearby Hazards: ${hazards}`,
    `- Local Tensions: ${tensions}`,
    `- Active Obligations: ${obligations}`,
    "- Hard Constraints: no advanced technology; no visible game stat screens in-world; respect route adjacency and deterministic engine facts.",
    "Treat this block as canonical current truth and narrate consistently with it.",
    `Structured Output: ${structuredOutputInstruction}`,
  ].join("\n");
}
