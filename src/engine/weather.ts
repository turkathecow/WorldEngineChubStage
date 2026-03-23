import { RegionDef, RegionWeatherState, StageInitState, StageMessageState, WeatherCondition, WeatherZoneDef } from "./types";

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function weatherVisibility(condition: WeatherCondition): "clear" | "hazy" | "poor" {
  switch (condition) {
    case "clear":
    case "overcast":
      return "clear";
    case "mist":
    case "rain":
    case "snow":
      return "hazy";
    default:
      return "poor";
  }
}

function eventChanceThreshold(zone: WeatherZoneDef): number {
  return Math.round(zone.eventPool.length * 7);
}

function chooseNextCondition(zone: WeatherZoneDef, initState: StageInitState, regionId: string, periodIndex: number): WeatherCondition {
  const profile = zone.seasonalProfiles[initState.worldDef.calendarDef.months[0].season];
  const seasonProfile = zone.seasonalProfiles[initState.mapDef.regions.find((region) => region.id === regionId) ? initState.worldDef.calendarDef.months[0].season : "Spring"];
  const candidateProfile = seasonProfile ?? profile;
  const seed = `${initState.worldSeed}:${regionId}:${periodIndex}`;
  return candidateProfile.commonConditions[hashString(seed) % candidateProfile.commonConditions.length];
}

function chooseProfile(zone: WeatherZoneDef, season: StageMessageState["clock"]["season"]) {
  return zone.seasonalProfiles[season];
}

export function buildInitialWeather(initState: StageInitState, clock: StageMessageState["clock"]): Record<string, RegionWeatherState> {
  const result: Record<string, RegionWeatherState> = {};
  for (const region of initState.mapDef.regions) {
    const zone = getWeatherZone(initState, region.weatherZoneId);
    const profile = chooseProfile(zone, clock.season);
    const baseCondition = profile.commonConditions[hashString(`${initState.worldSeed}:${region.id}:initial`) % profile.commonConditions.length];
    const persistenceHours = initState.worldDef.weatherModelDef.basePersistenceHours[initState.config.weatherPersistence];
    result[region.id] = {
      regionId: region.id,
      zoneId: zone.id,
      condition: baseCondition,
      intensity: baseCondition === "storm" || baseCondition === "acid-rain" || baseCondition === "volcanic-ash" ? 2 : 1,
      temperatureBand: profile.temperatureBand,
      visibility: weatherVisibility(baseCondition),
      activeEvent: null,
      nextShiftAtTotalMinutes: clock.totalMinutes + persistenceHours * 60,
    };
  }
  return result;
}

function maybeTriggerEvent(
  region: RegionDef,
  zone: WeatherZoneDef,
  initState: StageInitState,
  currentTotalMinutes: number,
): RegionWeatherState["activeEvent"] {
  if (zone.eventPool.length === 0) {
    return null;
  }
  const hourBucket = Math.floor(currentTotalMinutes / 60);
  const roll = hashString(`${initState.worldSeed}:${region.id}:event:${hourBucket}`) % 100;
  if (roll > eventChanceThreshold(zone)) {
    return null;
  }
  const chosen = zone.eventPool[roll % zone.eventPool.length];
  return {
    id: chosen.id,
    label: chosen.label,
    kind: chosen.kind,
    endsAtTotalMinutes: currentTotalMinutes + chosen.durationHours * 60,
  };
}

export function advanceWeather(initState: StageInitState, messageState: StageMessageState): StageMessageState["world"]["weatherByRegion"] {
  const nextWeather: StageMessageState["world"]["weatherByRegion"] = {};
  const persistenceHours = initState.worldDef.weatherModelDef.basePersistenceHours[initState.config.weatherPersistence];
  const currentTotalMinutes = messageState.clock.totalMinutes;
  const stepMinutes = persistenceHours * 60;

  for (const region of initState.mapDef.regions) {
    const existing = messageState.world.weatherByRegion[region.id];
    const zone = getWeatherZone(initState, region.weatherZoneId);
    const profile = chooseProfile(zone, messageState.clock.season);
    const periodIndex = Math.floor(currentTotalMinutes / stepMinutes);

    let condition = existing?.condition ?? profile.commonConditions[0];
    let intensity = existing?.intensity ?? 1;
    let activeEvent = existing?.activeEvent ?? null;

    if (activeEvent && activeEvent.endsAtTotalMinutes <= currentTotalMinutes) {
      activeEvent = null;
    }

    if (!existing || currentTotalMinutes >= existing.nextShiftAtTotalMinutes) {
      activeEvent = activeEvent ?? maybeTriggerEvent(region, zone, initState, currentTotalMinutes);
      if (activeEvent) {
        const template = zone.eventPool.find((event) => event.id === activeEvent?.id);
        if (template) {
          condition = template.resultingCondition;
          intensity = template.intensity;
        }
      } else {
        const nextCondition = chooseProfile(zone, messageState.clock.season).commonConditions[
          hashString(`${initState.worldSeed}:${region.id}:${periodIndex}`) % profile.commonConditions.length
        ];
        const shouldShift = hashString(`${initState.worldSeed}:${region.id}:shift:${periodIndex}`) % 100 > 25;
        condition = shouldShift ? nextCondition : condition;
        intensity = condition === "storm" || condition === "acid-rain" || condition === "volcanic-ash" ? 2 : 1;
      }
    }

    nextWeather[region.id] = {
      regionId: region.id,
      zoneId: zone.id,
      condition,
      intensity,
      temperatureBand: profile.temperatureBand,
      visibility: weatherVisibility(condition),
      activeEvent,
      nextShiftAtTotalMinutes: (!existing || currentTotalMinutes >= existing.nextShiftAtTotalMinutes)
        ? currentTotalMinutes + stepMinutes
        : existing.nextShiftAtTotalMinutes,
    };
  }

  return nextWeather;
}

export function weatherTravelPenalty(condition: WeatherCondition): number {
  switch (condition) {
    case "clear":
      return 1;
    case "overcast":
      return 1.05;
    case "mist":
      return 1.1;
    case "rain":
      return 1.15;
    case "snow":
      return 1.2;
    case "storm":
      return 1.4;
    case "blizzard":
      return 1.7;
    case "sandstorm":
      return 1.65;
    case "acid-rain":
      return 1.8;
    case "arcane-fog":
      return 1.35;
    case "volcanic-ash":
      return 1.7;
    default:
      return 1;
  }
}

export function describeWeather(condition: WeatherCondition): string {
  return condition
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function describeTemperature(temperatureBand: RegionWeatherState["temperatureBand"]): string {
  switch (temperatureBand) {
    case "very-cold":
      return "very cold";
    case "cold":
      return "cold";
    case "temperate":
      return "temperate";
    case "warm":
      return "warm";
    case "very-hot":
      return "very hot";
    default:
      return temperatureBand;
  }
}

export function getWeatherZone(initState: StageInitState, zoneId: string): WeatherZoneDef {
  const zone = initState.weatherZones.find((candidate) => candidate.id === zoneId);
  if (!zone) {
    throw new Error(`Unknown weather zone: ${zoneId}`);
  }
  return zone;
}
