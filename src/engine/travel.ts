import { RouteConditionState, RouteDef, StageInitState, StageMessageState } from "./types";
import { weatherTravelPenalty } from "./weather";

export function getAdjacentRoutes(initState: StageInitState, locationId: string): RouteDef[] {
  return initState.mapDef.routes.filter(
    (route) => route.fromLocationId === locationId || route.toLocationId === locationId,
  );
}

export function getOtherRouteEnd(route: RouteDef, locationId: string): string {
  return route.fromLocationId === locationId ? route.toLocationId : route.fromLocationId;
}

export function getRouteByLocations(initState: StageInitState, currentLocationId: string, targetLocationId: string): RouteDef | null {
  return (
    getAdjacentRoutes(initState, currentLocationId).find(
      (route) => getOtherRouteEnd(route, currentLocationId) === targetLocationId,
    ) ?? null
  );
}

function dangerLabel(danger: number): string {
  if (danger <= 2) {
    return "Low";
  }
  if (danger <= 4) {
    return "Guarded";
  }
  if (danger <= 6) {
    return "Risky";
  }
  if (danger <= 8) {
    return "High";
  }
  return "Extreme";
}

export function describeDanger(danger: number): string {
  return dangerLabel(danger);
}

export function recalculateRouteConditions(initState: StageInitState, messageState: StageMessageState): Record<string, RouteConditionState> {
  const result: Record<string, RouteConditionState> = {};

  for (const route of initState.mapDef.routes) {
    const fromRegionId = initState.mapDef.locations.find((location) => location.id === route.fromLocationId)?.regionId;
    const toRegionId = initState.mapDef.locations.find((location) => location.id === route.toLocationId)?.regionId;
    if (!fromRegionId || !toRegionId) {
      continue;
    }

    const fromWeather = messageState.world.weatherByRegion[fromRegionId];
    const toWeather = messageState.world.weatherByRegion[toRegionId];
    const weatherPenalty = Math.max(
      weatherTravelPenalty(fromWeather.condition),
      weatherTravelPenalty(toWeather.condition),
    );
    const difficultyPenalty = 1 + (route.difficulty - 1) * 0.12;
    const multiplier = Number((weatherPenalty * difficultyPenalty).toFixed(2));
    const danger = Math.min(
      10,
      route.hazardLevel + route.difficulty + (fromWeather.intensity - 1) + (toWeather.intensity - 1),
    );

    const reasons = [
      `Base difficulty ${route.difficulty}/5`,
      `${fromWeather.condition} near departure`,
      `${toWeather.condition} near destination`,
    ];

    let statusLabel = "Passable";
    if (multiplier >= 1.8) {
      statusLabel = "Treacherous";
    } else if (multiplier >= 1.4) {
      statusLabel = "Slow";
    } else if (multiplier >= 1.15) {
      statusLabel = "Muddy";
    }

    result[route.id] = {
      routeId: route.id,
      travelMultiplier: multiplier,
      danger,
      statusLabel,
      reasons,
      blocked: multiplier >= initState.worldDef.travelModelDef.blockedRouteThreshold,
    };
  }

  return result;
}

export function computeTravelMinutes(
  initState: StageInitState,
  route: RouteDef,
  routeCondition: RouteConditionState,
  fatigueValue: number,
): number {
  const fatiguePenalty = 1 + fatigueValue / 250;
  return Math.ceil(route.baseTravelMinutes * routeCondition.travelMultiplier * fatiguePenalty);
}

export function formatTravelTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
