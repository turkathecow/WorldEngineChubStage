import { describeReputation } from "./factions";
import { formatDate, formatTime } from "./clock";
import { formatMoney } from "./economy";
import { formatInventoryHighlights } from "./inventory";
import { describeDanger, formatTravelTime, getAdjacentRoutes, getOtherRouteEnd } from "./travel";
import { describeTemperature, describeWeather } from "./weather";
import { DashboardViewModel, LocationDef, StageChatState, StageInitState, StageMessageState } from "./types";
import { formatFatigue } from "./conditions";
import { buildIncarnationNote, buildKnownSpawnChoices, isSpawnedState } from "./spawnResolution";

export function getLocation(initState: StageInitState, locationId: string): LocationDef {
  const location = initState.mapDef.locations.find((candidate) => candidate.id === locationId);
  if (!location) {
    throw new Error(`Unknown location: ${locationId}`);
  }
  return location;
}

export function getRegionName(initState: StageInitState, regionId: string): string {
  return initState.mapDef.regions.find((region) => region.id === regionId)?.name ?? regionId;
}

export function buildDashboardViewModel(
  initState: StageInitState,
  messageState: StageMessageState,
  chatState: StageChatState,
): DashboardViewModel {
  const knownChoices = buildKnownSpawnChoices(initState, messageState);
  const pendingNote = buildIncarnationNote(messageState);

  if (!isSpawnedState(messageState) || !messageState.player.locationId || !messageState.player.regionId) {
    const candidateRegion = messageState.spawnCandidate?.chosenRegionId
      ? initState.mapDef.regions.find((region) => region.id === messageState.spawnCandidate?.chosenRegionId)
      : null;
    const candidateLocation = messageState.spawnCandidate?.chosenLocationId
      ? initState.mapDef.locations.find((location) => location.id === messageState.spawnCandidate?.chosenLocationId)
      : null;

    return {
      topLine: {
        dateLabel: formatDate(messageState.clock, initState.worldDef.calendarDef),
        timeLabel: formatTime(messageState.clock),
        season: messageState.clock.season,
        location: candidateLocation?.name ?? "Not yet determined",
        region: candidateRegion?.name ?? "Not yet determined",
      },
      location: {
        locationName: candidateLocation?.name ?? "Not yet determined",
        regionName: candidateRegion?.name ?? "Not yet determined",
        continent: candidateRegion?.continent ?? "World blueprint ready",
        description: pendingNote,
        connectedRoutes: [],
        explored: false,
        pending: true,
        statusLabel: messageState.incarnationPhase === "resolving" ? "Resolving" : "Pending",
        note: pendingNote,
        knownChoices,
      },
      weather: {
        conditionLabel: "Not yet determined",
        temperatureLabel: "Local conditions unresolved",
        eventLabel: null,
        travelNote: "Route timing and local hazards will appear once a concrete spawn is established.",
        pending: true,
        note: "Local weather is unresolved until the reincarnation outcome establishes a real location.",
      },
      status: {
        moneyLabel: "Not assigned",
        fatigueLabel: "Not assigned",
        injuries: [],
        nearbyHazards: [],
        pending: true,
        note: "Conditions, injuries, money, and hazards stay unset until the player exists in a concrete place.",
      },
      inventory: {
        highlights: [],
        pending: true,
        note: "No starting inventory has been assigned yet.",
      },
      reputation: {
        entries: [],
        pending: true,
        note: "Faction standing is pending until origin and local ties are grounded by the chat.",
      },
      quests: {
        entries: [],
        pending: true,
        note: "No grounded obligations have been assigned before spawn resolution.",
      },
      map: {
        currentLocationId: null,
        currentLocationName: "Incarnation unresolved",
        adjacentLocations: [],
        pending: true,
        note: "No current route node exists until a spawn location is established.",
      },
      engineNote: messageState.ui.lastEngineNote,
    };
  }

  const currentLocation = getLocation(initState, messageState.player.locationId);
  const currentRegion = initState.mapDef.regions.find((region) => region.id === currentLocation.regionId);
  if (!currentRegion) {
    throw new Error(`Unknown region: ${currentLocation.regionId}`);
  }

  const weather = messageState.world.weatherByRegion[currentRegion.id];
  const routeEntries = getAdjacentRoutes(initState, currentLocation.id).map((route) => {
    const destinationId = getOtherRouteEnd(route, currentLocation.id);
    const destination = getLocation(initState, destinationId);
    const routeCondition = messageState.world.routeConditions[route.id];
    return {
      routeId: route.id,
      destinationName: destination.name,
      travelTimeLabel: formatTravelTime(Math.ceil(route.baseTravelMinutes * routeCondition.travelMultiplier)),
      statusLabel: routeCondition.statusLabel,
      dangerLabel: describeDanger(routeCondition.danger),
    };
  });

  const reputation = initState.factions.map((faction) => {
    const score = messageState.player.reputation[faction.id] ?? 0;
    return {
      factionName: faction.name,
      standingLabel: describeReputation(score),
      score,
    };
  });

  return {
    topLine: {
      dateLabel: formatDate(messageState.clock, initState.worldDef.calendarDef),
      timeLabel: formatTime(messageState.clock),
      season: messageState.clock.season,
      location: currentLocation.name,
      region: currentRegion.name,
    },
    location: {
      locationName: currentLocation.name,
      regionName: currentRegion.name,
      continent: currentRegion.continent,
      description: currentLocation.description,
      connectedRoutes: routeEntries,
      explored: chatState.exploredLocations.includes(currentLocation.id),
      pending: false,
      statusLabel: chatState.exploredLocations.includes(currentLocation.id) ? "Explored" : "Unexplored",
      note: currentLocation.description,
      knownChoices,
    },
    weather: {
      conditionLabel: describeWeather(weather.condition),
      temperatureLabel: describeTemperature(weather.temperatureBand),
      eventLabel: weather.activeEvent?.label ?? null,
      travelNote: routeEntries.length === 0 ? "No known direct routes." : routeEntries.map((route) => `${route.destinationName}: ${route.statusLabel}`).join(" | "),
      pending: false,
      note: "Local weather is grounded by the current region.",
    },
    status: {
      moneyLabel: messageState.player.money ? formatMoney(messageState.player.money) : "Not assigned",
      fatigueLabel: messageState.player.fatigue ? formatFatigue(messageState.player.fatigue) : "Not assigned",
      injuries: messageState.player.injuries.map((injury) => `${injury.label} (${injury.severity})`),
      nearbyHazards: messageState.scene.immediateHazards,
      pending: false,
      note: "Player-local conditions are active.",
    },
    inventory: {
      highlights: formatInventoryHighlights(messageState.player.inventory, initState.itemCatalog),
      pending: false,
      note: "Current carried highlights.",
    },
    reputation: {
      entries: reputation,
      pending: false,
      note: "Grounded faction standing.",
    },
    quests: {
      entries: messageState.player.activeQuests
        .filter((quest) => quest.status === "active")
        .map((quest) => ({
          id: quest.id,
          title: quest.title,
          obligationLevel: quest.obligationLevel,
          summary: quest.summary,
        })),
      pending: false,
      note: "Active grounded obligations.",
    },
    map: {
      currentLocationId: currentLocation.id,
      currentLocationName: currentLocation.name,
      adjacentLocations: routeEntries.map((route) => {
        const destinationId = getAdjacentRoutes(initState, currentLocation.id).find(
          (candidate) => candidate.id === route.routeId,
        );
        const currentRoute = destinationId;
        if (!currentRoute) {
          throw new Error(`Route not found: ${route.routeId}`);
        }
        const id = getOtherRouteEnd(currentRoute, currentLocation.id);
        return {
          id,
          name: route.destinationName,
          routeLabel: `${route.travelTimeLabel} • ${route.statusLabel} • ${route.dangerLabel}`,
          explored: chatState.exploredLocations.includes(id),
        };
      }),
      pending: false,
      note: "Adjacent deterministic routes from the current location.",
    },
    engineNote: messageState.ui.lastEngineNote,
  };
}
