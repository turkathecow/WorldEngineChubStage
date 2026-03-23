import { describeReputation } from "./factions";
import { formatDate, formatTime } from "./clock";
import { formatMoney } from "./economy";
import { formatInventoryHighlights } from "./inventory";
import { describeDanger, formatTravelTime, getAdjacentRoutes, getOtherRouteEnd } from "./travel";
import { describeTemperature, describeWeather } from "./weather";
import { DashboardViewModel, LocationDef, StageChatState, StageInitState, StageMessageState } from "./types";
import { formatFatigue } from "./conditions";

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
    },
    weather: {
      conditionLabel: describeWeather(weather.condition),
      temperatureLabel: describeTemperature(weather.temperatureBand),
      eventLabel: weather.activeEvent?.label ?? null,
      travelNote: routeEntries.length === 0 ? "No known direct routes." : routeEntries.map((route) => `${route.destinationName}: ${route.statusLabel}`).join(" | "),
    },
    status: {
      moneyLabel: formatMoney(messageState.player.money),
      fatigueLabel: formatFatigue(messageState.player.fatigue),
      injuries: messageState.player.injuries.map((injury) => `${injury.label} (${injury.severity})`),
      nearbyHazards: messageState.scene.immediateHazards,
    },
    inventory: {
      highlights: formatInventoryHighlights(messageState.player.inventory, initState.itemCatalog),
    },
    reputation,
    quests: messageState.player.activeQuests
      .filter((quest) => quest.status === "active")
      .map((quest) => ({
        id: quest.id,
        title: quest.title,
        obligationLevel: quest.obligationLevel,
        summary: quest.summary,
      })),
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
    },
    engineNote: messageState.ui.lastEngineNote,
  };
}
