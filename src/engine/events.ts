import { DynamicEventState, StageInitState, StageMessageState } from "./types";

function hasEvent(worldEvents: DynamicEventState[], id: string): boolean {
  return worldEvents.some((event) => event.id === id);
}

export function buildInitialEvents(initState: StageInitState, currentTotalMinutes: number): DynamicEventState[] {
  return [
    {
      id: "event-eter-exams",
      label: "Eter entrance examinations",
      kind: "political",
      severity: "moderate",
      summary: "Applicants, patrons, and spies are swelling traffic between Gursa and the academy.",
      locationId: "eter-royal-magic-academy",
      regionId: "gursa-leymarsh",
      expiresAtTotalMinutes: currentTotalMinutes + 12 * 24 * 60,
    },
    {
      id: "event-marusa-raiders",
      label: "Marusa raider sightings",
      kind: "monster",
      severity: "high",
      summary: "Pirate and monster reports are making the sea lanes tense near Ascalos Watch.",
      locationId: "ascalos-watch",
      regionId: "marusa-western-reach",
      expiresAtTotalMinutes: currentTotalMinutes + 8 * 24 * 60,
    },
  ];
}

export function advanceEvents(initState: StageInitState, messageState: StageMessageState): DynamicEventState[] {
  const currentTotalMinutes = messageState.clock.totalMinutes;
  const active = messageState.world.dynamicEvents.filter((event) => event.expiresAtTotalMinutes > currentTotalMinutes);

  const currentSeason = messageState.clock.season;
  if (
    currentSeason === "Winter" &&
    !hasEvent(active, "event-central-storm") &&
    messageState.world.weatherByRegion["great-central-footholds"]?.intensity >= 2
  ) {
    active.push({
      id: "event-central-storm",
      label: "Great Central ascent warning",
      kind: "weather",
      severity: "high",
      summary: "Expeditions toward the Great Central Mountain are delaying under violent anomaly weather.",
      locationId: "great-central-foothold",
      regionId: "great-central-footholds",
      expiresAtTotalMinutes: currentTotalMinutes + 3 * 24 * 60,
    });
  }

  const academyWeather = messageState.world.weatherByRegion["gursa-leymarsh"];
  if (
    academyWeather?.activeEvent?.kind === "acid-rain" &&
    !hasEvent(active, "event-gursa-wards")
  ) {
    active.push({
      id: "event-gursa-wards",
      label: "Ley wards under strain",
      kind: "weather",
      severity: "moderate",
      summary: "Gursa authorities are reinforcing protective wards as acid rain moves through the marsh.",
      locationId: "gursa-city",
      regionId: "gursa-leymarsh",
      expiresAtTotalMinutes: currentTotalMinutes + 24 * 60,
    });
  }

  return active;
}

export function buildLocalRumors(initState: StageInitState, messageState: StageMessageState): Record<string, string[]> {
  const rumors: Record<string, string[]> = {};
  for (const location of initState.mapDef.locations) {
    rumors[location.id] = [];
  }

  for (const event of messageState.world.dynamicEvents) {
    if (event.locationId) {
      rumors[event.locationId] = [...(rumors[event.locationId] ?? []), event.summary];
    }
  }

  rumors["niria-village"] = [
    ...(rumors["niria-village"] ?? []),
    "Travelers say Gursa has grown crowded with academy hopefuls and guild recruiters.",
  ];
  rumors["ascalos-watch"] = [
    ...(rumors["ascalos-watch"] ?? []),
    "Sailors keep lowering their voices whenever the Brotherhood of the Golden Sun is mentioned.",
  ];

  return rumors;
}
