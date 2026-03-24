export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
export type SurvivalMode = "off" | "light" | "moderate";
export type InjuryRealism = "low" | "medium" | "high";
export type WeatherPersistence = "low" | "medium" | "high";
export type EconomyComplexity = "simple" | "moderate";
export type RouteKind = "road" | "trail" | "canal" | "sea-lane" | "mountain-pass";
export type DifficultyBand = 1 | 2 | 3 | 4 | 5;
export type WeatherCondition =
  | "clear"
  | "overcast"
  | "mist"
  | "rain"
  | "storm"
  | "snow"
  | "blizzard"
  | "sandstorm"
  | "acid-rain"
  | "arcane-fog"
  | "volcanic-ash";
export type TemperatureBand = "very-cold" | "cold" | "temperate" | "warm" | "very-hot";
export type WeatherEventKind =
  | "winter-storm"
  | "thunderstorm"
  | "typhoon"
  | "drought"
  | "sandstorm"
  | "acid-rain"
  | "scattered-showers"
  | "volcanic-eruption"
  | "arcane-distortion";
export type FactionKind = "guild" | "city-authority" | "academy" | "hostile" | "polity";
export type LocationKind =
  | "village"
  | "city"
  | "academy"
  | "frontier"
  | "port"
  | "wilderness"
  | "dungeon-approach";
export type MarketMood = "stable" | "tight" | "scarce";
export type EventSeverity = "low" | "moderate" | "high";
export type DynamicEventKind = "rumor" | "weather" | "political" | "monster" | "trade";
export type ActorDisposition = "friendly" | "neutral" | "guarded" | "hostile";
export type DashboardPanel = "overview" | "status" | "inventory" | "reputation" | "quests" | "map";
export type ActionCategory = "wait" | "travel" | "inspect" | "shop" | "talk" | "enter" | "fallback";
export type ShopAction = "buy" | "sell";
export type QuestStatus = "active" | "paused" | "complete";
export type ObligationLevel = "low" | "medium" | "high";
export type ConditionSeverity = "minor" | "moderate" | "serious";
export type FatigueBand = "fresh" | "worn" | "tired" | "spent";
export type IncarnationPhase = "unresolved" | "resolving" | "spawned";
export type StartRoleId =
  | "reborn-wanderer"
  | "academy-hopeful"
  | "caravan-hand"
  | "castaway"
  | "minor-noble-exile";

export interface StageConfig {
  worldSeed: string;
  startRegionId: string;
  startRole: StartRoleId;
  survivalMode: SurvivalMode;
  injuryRealism: InjuryRealism;
  weatherPersistence: WeatherPersistence;
  economyComplexity: EconomyComplexity;
  showMapPanel: boolean;
}

export interface MonthDef {
  id: string;
  name: string;
  season: Season;
  days: number;
}

export interface CalendarDef {
  months: MonthDef[];
  hoursPerDay: number;
  minutesPerHour: number;
}

export interface SeasonWeatherProfile {
  commonConditions: WeatherCondition[];
  temperatureBand: TemperatureBand;
  precipitationBias: number;
  windBias: number;
  instability: number;
}

export interface WeatherEventTemplate {
  id: string;
  label: string;
  kind: WeatherEventKind;
  durationHours: number;
  intensity: 1 | 2 | 3;
  resultingCondition: WeatherCondition;
}

export interface WeatherZoneDef {
  id: string;
  name: string;
  climateKind: string;
  seasonalProfiles: Record<Season, SeasonWeatherProfile>;
  eventPool: WeatherEventTemplate[];
}

export interface WorldRulesDef {
  calendarDef: CalendarDef;
  weatherModelDef: {
    updateStepHours: number;
    basePersistenceHours: Record<WeatherPersistence, number>;
  };
  travelModelDef: {
    fatiguePerTravelHour: number;
    difficultRouteFatigueBonus: number;
    severeWeatherMultiplier: number;
    blockedRouteThreshold: number;
  };
  economyModelDef: {
    copperPerSilver: number;
    silverPerGold: number;
    goldPerDiamond: number;
  };
  injuryModelDef: {
    travelStrainThreshold: number;
    restRecoveryHours: number;
  };
}

export interface WorldFact {
  id: string;
  title: string;
  summary: string;
}

export interface RegionDef {
  id: string;
  name: string;
  continent: "Lumeria" | "Orisc" | "Marusa Sea";
  weatherZoneId: string;
  description: string;
  tags: string[];
}

export interface LocationDef {
  id: string;
  name: string;
  regionId: string;
  kind: LocationKind;
  description: string;
  tags: string[];
  factionIds: string[];
  market: boolean;
  codexEntryId: string;
}

export interface RouteDef {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  kind: RouteKind;
  baseTravelMinutes: number;
  difficulty: DifficultyBand;
  hazardLevel: DifficultyBand;
  notes: string;
}

export interface FactionDef {
  id: string;
  name: string;
  kind: FactionKind;
  homeLocationId: string;
  description: string;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  baseValueInCopper: number;
  tags: string[];
  highlight: boolean;
}

export interface RoleStartDef {
  id: StartRoleId;
  label: string;
  startLocationId: string;
  description: string;
  startingMoneyInCopper: number;
  starterItemIds: Array<{ itemId: string; quantity: number }>;
  startingQuestIds: string[];
}

export interface QuestTemplate {
  id: string;
  title: string;
  summary: string;
  obligationLevel: ObligationLevel;
}

export interface StaticActorTemplate {
  id: string;
  locationId: string;
  name: string;
  role: string;
  disposition: ActorDisposition;
  factionId?: string;
  note: string;
}

export interface MapDef {
  worldFacts: WorldFact[];
  regions: RegionDef[];
  locations: LocationDef[];
  routes: RouteDef[];
}

export interface StageInitState {
  worldSeed: string;
  rulesetVersion: string;
  worldDef: WorldRulesDef;
  mapDef: MapDef;
  factions: FactionDef[];
  weatherZones: WeatherZoneDef[];
  itemCatalog: ItemDef[];
  roleStarts: RoleStartDef[];
  questCatalog: QuestTemplate[];
  staticActors: StaticActorTemplate[];
  config: StageConfig;
}

export interface ClockState {
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  season: Season;
  totalMinutes: number;
}

export interface MoneyWallet {
  copper: number;
  silver: number;
  gold: number;
  diamond: number;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface InjuryState {
  id: string;
  label: string;
  severity: ConditionSeverity;
  treatmentNeeded: boolean;
}

export interface FatigueState {
  value: number;
  band: FatigueBand;
}

export interface QuestState {
  id: string;
  title: string;
  status: QuestStatus;
  summary: string;
  obligationLevel: ObligationLevel;
}

export interface PartyMemberState {
  id: string;
  name: string;
  role: string;
  condition: string;
}

export interface SpawnCandidate {
  chosenRace?: string;
  chosenGender?: string;
  chosenAppearance?: string;
  chosenFamily?: string;
  chosenRole?: StartRoleId;
  chosenLocationText?: string;
  chosenRegionId?: string;
  chosenLocationId?: string;
  confidence?: number;
}

export interface PlayerState {
  roleBackground: StartRoleId | null;
  locationId: string | null;
  regionId: string | null;
  sublocation: string | null;
  money: MoneyWallet | null;
  inventory: InventoryEntry[];
  injuries: InjuryState[];
  fatigue: FatigueState | null;
  reputation: Record<string, number>;
  activeQuests: QuestState[];
  party: PartyMemberState[];
}

export interface ActiveWeatherEvent {
  id: string;
  label: string;
  kind: WeatherEventKind;
  endsAtTotalMinutes: number;
}

export interface RegionWeatherState {
  regionId: string;
  zoneId: string;
  condition: WeatherCondition;
  intensity: 1 | 2 | 3;
  temperatureBand: TemperatureBand;
  visibility: "clear" | "hazy" | "poor";
  activeEvent: ActiveWeatherEvent | null;
  nextShiftAtTotalMinutes: number;
}

export interface RouteConditionState {
  routeId: string;
  travelMultiplier: number;
  danger: number;
  statusLabel: string;
  reasons: string[];
  blocked: boolean;
}

export interface SettlementState {
  locationId: string;
  marketMood: MarketMood;
  tension: number;
  authority: string;
  notableIssue: string | null;
}

export interface DynamicEventState {
  id: string;
  label: string;
  kind: DynamicEventKind;
  severity: EventSeverity;
  summary: string;
  locationId: string | null;
  regionId: string | null;
  expiresAtTotalMinutes: number;
}

export interface LocalActorState {
  id: string;
  name: string;
  role: string;
  disposition: ActorDisposition;
  factionId: string | null;
  locationId: string;
  note: string;
}

export interface WorldState {
  weatherByRegion: Record<string, RegionWeatherState>;
  routeConditions: Record<string, RouteConditionState>;
  settlementStates: Record<string, SettlementState>;
  dynamicEvents: DynamicEventState[];
  localRumors: Record<string, string[]>;
  localActors: Record<string, LocalActorState[]>;
}

export interface ResolvedActionSummary {
  category: ActionCategory;
  label: string;
  timeAdvancedMinutes: number;
  blocked: boolean;
  details: string[];
  destinationLocationId: string | null;
  touchedSystems: string[];
}

export interface SceneState {
  visibleActors: string[];
  visibleObjects: string[];
  immediateHazards: string[];
  lastResolvedAction: ResolvedActionSummary | null;
}

export interface SoftNpcRecord {
  id: string;
  name: string;
  role: string | null;
  locationHint: string | null;
  factionHint: string | null;
  dispositionHint: string | null;
  sourceMessageId: string;
  firstMentionedAtTotalMinutes: number;
  lastMentionedAtTotalMinutes: number;
}

export interface SoftSceneObjectRecord {
  id: string;
  name: string;
  description: string | null;
  locationHint: string | null;
  portable: boolean | null;
  sourceMessageId: string;
  firstMentionedAtTotalMinutes: number;
  lastMentionedAtTotalMinutes: number;
}

export interface SoftFactsState {
  knownNpcs: SoftNpcRecord[];
  sceneObjects: SoftSceneObjectRecord[];
  rumors: string[];
  codexUnlocks: string[];
  environmentNotes: string[];
}

export interface UIState {
  selectedPanel: DashboardPanel;
  mapFocusLocationId: string | null;
  lastEngineNote: string | null;
}

export interface StageMessageState {
  incarnationPhase: IncarnationPhase;
  spawnCandidate: SpawnCandidate | null;
  clock: ClockState;
  player: PlayerState;
  world: WorldState;
  scene: SceneState;
  softFacts: SoftFactsState;
  ui: UIState;
}

export interface LlmStageStateBlock {
  new_npcs?: Array<{
    id?: string;
    name: string;
    role?: string;
    locationHint?: string;
    factionHint?: string;
    dispositionHint?: string;
  }>;
  new_scene_objects?: Array<{
    name: string;
    description?: string;
    locationHint?: string;
    portable?: boolean;
  }>;
  rumors_or_tensions?: string[];
  suggested_codex_unlocks?: string[];
  notable_environment_changes?: string[];
}

export interface NormalizedLlmStageNpc {
  id: string;
  name: string;
  role: string | null;
  locationHint: string | null;
  factionHint: string | null;
  dispositionHint: string | null;
}

export interface NormalizedLlmStageSceneObject {
  id: string;
  name: string;
  description: string | null;
  locationHint: string | null;
  portable: boolean | null;
}

export interface NormalizedLlmStageStateBlock {
  newNpcs: NormalizedLlmStageNpc[];
  newSceneObjects: NormalizedLlmStageSceneObject[];
  rumorsOrTensions: string[];
  suggestedCodexUnlocks: string[];
  notableEnvironmentChanges: string[];
}

export interface StageChatState {
  exploredLocations: string[];
  discoveredLoreEntries: string[];
  tutorialFlags: string[];
  unlockedSystems: string[];
}

export interface ActionIntent {
  category: ActionCategory;
  targetLocationId: string | null;
  targetItemId: string | null;
  shopAction: ShopAction | null;
  quantity: number;
  selectedPanel: DashboardPanel | null;
  sublocation: string | null;
  rawText: string;
}

export interface ActionResolution {
  messageState: StageMessageState;
  chatState: StageChatState;
  action: ResolvedActionSummary;
}

export interface DashboardViewModel {
  topLine: {
    dateLabel: string;
    timeLabel: string;
    season: Season;
    location: string;
    region: string;
  };
  location: {
    locationName: string;
    regionName: string;
    continent: string;
    description: string;
    connectedRoutes: Array<{
      routeId: string;
      destinationName: string;
      travelTimeLabel: string;
      statusLabel: string;
      dangerLabel: string;
    }>;
    explored: boolean;
    pending: boolean;
    statusLabel: string;
    note: string;
    knownChoices: Array<{
      label: string;
      value: string;
    }>;
  };
  weather: {
    conditionLabel: string;
    temperatureLabel: string;
    eventLabel: string | null;
    travelNote: string;
    pending: boolean;
    note: string;
  };
  status: {
    moneyLabel: string;
    fatigueLabel: string;
    injuries: string[];
    nearbyHazards: string[];
    pending: boolean;
    note: string;
  };
  inventory: {
    highlights: string[];
    pending: boolean;
    note: string;
  };
  reputation: {
    entries: Array<{
      factionName: string;
      standingLabel: string;
      score: number;
    }>;
    pending: boolean;
    note: string;
  };
  quests: {
    entries: Array<{
      id: string;
      title: string;
      obligationLevel: ObligationLevel;
      summary: string;
    }>;
    pending: boolean;
    note: string;
  };
  map: {
    currentLocationId: string | null;
    currentLocationName: string;
    adjacentLocations: Array<{
      id: string;
      name: string;
      routeLabel: string;
      explored: boolean;
    }>;
    pending: boolean;
    note: string;
  };
  engineNote: string | null;
}
