import {
  LlmStageStateBlock,
  NormalizedLlmStageStateBlock,
  StageChatState,
  StageInitState,
} from "./types";
import { ensureArrayIncludes } from "./reducers";

export const STAGE_STATE_OPEN = "[STAGE_STATE]";
export const STAGE_STATE_CLOSE = "[/STAGE_STATE]";

const MAX_NEW_NPCS = 5;
const MAX_NEW_SCENE_OBJECTS = 8;
const MAX_RUMORS = 5;
const MAX_CODEX_UNLOCKS = 5;
const MAX_ENVIRONMENT_CHANGES = 5;

const MAX_ID_LENGTH = 64;
const MAX_NAME_LENGTH = 64;
const MAX_ROLE_LENGTH = 64;
const MAX_HINT_LENGTH = 72;
const MAX_DESCRIPTION_LENGTH = 160;
const MAX_RUMOR_LENGTH = 180;
const MAX_CODEX_LENGTH = 72;
const MAX_ENVIRONMENT_NOTE_LENGTH = 180;

const ALLOWED_KEYS = new Set([
  "new_npcs",
  "new_scene_objects",
  "rumors_or_tensions",
  "suggested_codex_unlocks",
  "notable_environment_changes",
]);

interface PlainObject {
  [key: string]: unknown;
}

export interface StageStateBlockExtraction {
  found: boolean;
  wellFormed: boolean;
  blockText: string | null;
  jsonText: string | null;
  strippedResponse: string;
  issues: string[];
}

export interface StageStateBlockParseResult {
  value: unknown | null;
  error: string | null;
}

export interface StageStateBlockValidationResult {
  value: LlmStageStateBlock | null;
  issues: string[];
}

/*
 Sample valid response:
 The inn yard smells of wet straw and lamp oil.
 [STAGE_STATE]
 {"new_npcs":[{"name":"Mira Vale","role":"Inn factor"}],"rumors_or_tensions":["Teamsters whisper about late caravans."]}
 [/STAGE_STATE]

 Sample malformed block:
 The gate rattles in the wind.
 [STAGE_STATE]
 {"new_npcs":[{"name":7}]}
 [/STAGE_STATE]
*/
export function buildStructuredOutputInstruction(): string {
  return [
    "After the visible prose, append exactly one trailing [STAGE_STATE] JSON block and nothing after it.",
    "Include only newly introduced soft facts from this response. Allowed keys: new_npcs, new_scene_objects, rumors_or_tensions, suggested_codex_unlocks, notable_environment_changes.",
    "Do not include canonical state changes such as money, currency, inventory counts, exact location changes, time, weather, route conditions, quest completion, injuries, or faction score changes.",
    "If there are no new soft facts, emit {}. The block must contain valid JSON only.",
  ].join(" ");
}

export function extractStageStateBlock(rawResponse: string): StageStateBlockExtraction {
  const startIndex = rawResponse.indexOf(STAGE_STATE_OPEN);
  const lastStartIndex = rawResponse.lastIndexOf(STAGE_STATE_OPEN);
  const endIndex = rawResponse.indexOf(STAGE_STATE_CLOSE);
  const lastEndIndex = rawResponse.lastIndexOf(STAGE_STATE_CLOSE);

  if (startIndex === -1 && endIndex === -1) {
    return {
      found: false,
      wellFormed: false,
      blockText: null,
      jsonText: null,
      strippedResponse: rawResponse,
      issues: [],
    };
  }

  const issues: string[] = [];
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    issues.push("Malformed STAGE_STATE delimiters.");
    return {
      found: true,
      wellFormed: false,
      blockText: null,
      jsonText: null,
      strippedResponse: rawResponse,
      issues,
    };
  }

  if (startIndex !== lastStartIndex || endIndex !== lastEndIndex) {
    issues.push("Expected exactly one STAGE_STATE block.");
    return {
      found: true,
      wellFormed: false,
      blockText: null,
      jsonText: null,
      strippedResponse: rawResponse,
      issues,
    };
  }

  const blockEnd = endIndex + STAGE_STATE_CLOSE.length;
  const trailingText = rawResponse.slice(blockEnd);
  if (trailingText.trim().length > 0) {
    issues.push("Structured block must be the last content in the response.");
    return {
      found: true,
      wellFormed: false,
      blockText: null,
      jsonText: null,
      strippedResponse: rawResponse,
      issues,
    };
  }

  const blockText = rawResponse.slice(startIndex, blockEnd);
  const jsonText = rawResponse.slice(startIndex + STAGE_STATE_OPEN.length, endIndex).trim();

  return {
    found: true,
    wellFormed: true,
    blockText,
    jsonText,
    // Strip the machine block from the user-visible reply once it has been isolated.
    strippedResponse: rawResponse.slice(0, startIndex).trimEnd(),
    issues,
  };
}

export function parseStageStateBlock(blockText: string): StageStateBlockParseResult {
  try {
    return {
      value: JSON.parse(blockText),
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : "Unknown JSON parse failure.",
    };
  }
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function validateNpc(value: unknown): NonNullable<LlmStageStateBlock["new_npcs"]>[number] | null {
  if (!isPlainObject(value) || typeof value.name !== "string") {
    return null;
  }

  const id = readOptionalString(value.id) ?? undefined;
  const role = readOptionalString(value.role) ?? undefined;
  const locationHint = readOptionalString(value.locationHint) ?? undefined;
  const factionHint = readOptionalString(value.factionHint) ?? undefined;
  const dispositionHint = readOptionalString(value.dispositionHint) ?? undefined;

  return {
    id,
    name: value.name,
    role,
    locationHint,
    factionHint,
    dispositionHint,
  };
}

function validateSceneObject(value: unknown): NonNullable<LlmStageStateBlock["new_scene_objects"]>[number] | null {
  if (!isPlainObject(value) || typeof value.name !== "string") {
    return null;
  }

  const description = readOptionalString(value.description) ?? undefined;
  const locationHint = readOptionalString(value.locationHint) ?? undefined;
  const portable = readOptionalBoolean(value.portable) ?? undefined;

  return {
    name: value.name,
    description,
    locationHint,
    portable,
  };
}

function validateStringArray(values: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(values)) {
    return null;
  }

  const next: string[] = [];
  for (const entry of values) {
    if (typeof entry !== "string") {
      continue;
    }
    next.push(entry);
    if (next.length >= maxItems) {
      break;
    }
  }
  return next;
}

export function validateStageStateBlock(value: unknown): StageStateBlockValidationResult {
  if (!isPlainObject(value)) {
    return {
      value: null,
      issues: ["STAGE_STATE JSON must be an object."],
    };
  }

  const issues: string[] = [];
  const next: LlmStageStateBlock = {};

  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) {
      issues.push(`Ignoring unsupported STAGE_STATE key: ${key}.`);
    }
  }

  if ("new_npcs" in value) {
    if (!Array.isArray(value.new_npcs)) {
      issues.push("new_npcs must be an array.");
    } else {
      next.new_npcs = value.new_npcs.map(validateNpc).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    }
  }

  if ("new_scene_objects" in value) {
    if (!Array.isArray(value.new_scene_objects)) {
      issues.push("new_scene_objects must be an array.");
    } else {
      next.new_scene_objects = value.new_scene_objects
        .map(validateSceneObject)
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    }
  }

  if ("rumors_or_tensions" in value) {
    const rumors = validateStringArray(value.rumors_or_tensions, MAX_RUMORS);
    if (rumors === null) {
      issues.push("rumors_or_tensions must be an array of strings.");
    } else {
      next.rumors_or_tensions = rumors;
    }
  }

  if ("suggested_codex_unlocks" in value) {
    const codexUnlocks = validateStringArray(value.suggested_codex_unlocks, MAX_CODEX_UNLOCKS);
    if (codexUnlocks === null) {
      issues.push("suggested_codex_unlocks must be an array of strings.");
    } else {
      next.suggested_codex_unlocks = codexUnlocks;
    }
  }

  if ("notable_environment_changes" in value) {
    const environmentChanges = validateStringArray(value.notable_environment_changes, MAX_ENVIRONMENT_CHANGES);
    if (environmentChanges === null) {
      issues.push("notable_environment_changes must be an array of strings.");
    } else {
      next.notable_environment_changes = environmentChanges;
    }
  }

  return {
    value: next,
    issues,
  };
}

function normalizeWhitespace(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeOptionalString(value: string | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeWhitespace(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeIdentifier(value: string, fallbackPrefix: string): string {
  const normalized = value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_LENGTH);
  return normalized.length > 0 ? normalized : fallbackPrefix;
}

export function normalizeStageStateBlock(value: LlmStageStateBlock): NormalizedLlmStageStateBlock {
  const npcKeys = new Set<string>();
  const objectKeys = new Set<string>();
  const rumorKeys = new Set<string>();
  const codexKeys = new Set<string>();
  const environmentKeys = new Set<string>();

  const newNpcs = (value.new_npcs ?? []).reduce<NormalizedLlmStageStateBlock["newNpcs"]>((entries, npc) => {
    if (entries.length >= MAX_NEW_NPCS) {
      return entries;
    }

    const name = normalizeOptionalString(npc.name, MAX_NAME_LENGTH);
    if (!name) {
      return entries;
    }

    const id = normalizeIdentifier(npc.id ?? name, "npc");
    if (npcKeys.has(id)) {
      return entries;
    }

    npcKeys.add(id);
    entries.push({
      id,
      name,
      role: normalizeOptionalString(npc.role, MAX_ROLE_LENGTH),
      locationHint: normalizeOptionalString(npc.locationHint, MAX_HINT_LENGTH),
      factionHint: normalizeOptionalString(npc.factionHint, MAX_HINT_LENGTH),
      dispositionHint: normalizeOptionalString(npc.dispositionHint, MAX_HINT_LENGTH),
    });
    return entries;
  }, []);

  const newSceneObjects = (value.new_scene_objects ?? []).reduce<NormalizedLlmStageStateBlock["newSceneObjects"]>(
    (entries, sceneObject) => {
      if (entries.length >= MAX_NEW_SCENE_OBJECTS) {
        return entries;
      }

      const name = normalizeOptionalString(sceneObject.name, MAX_NAME_LENGTH);
      if (!name) {
        return entries;
      }

      const locationHint = normalizeOptionalString(sceneObject.locationHint, MAX_HINT_LENGTH);
      const dedupeKey = normalizeIdentifier(`${name}-${locationHint ?? "scene"}`, "scene-object");
      if (objectKeys.has(dedupeKey)) {
        return entries;
      }

      objectKeys.add(dedupeKey);
      entries.push({
        id: dedupeKey,
        name,
        description: normalizeOptionalString(sceneObject.description, MAX_DESCRIPTION_LENGTH),
        locationHint,
        portable: typeof sceneObject.portable === "boolean" ? sceneObject.portable : null,
      });
      return entries;
    },
    [],
  );

  const rumorsOrTensions = (value.rumors_or_tensions ?? []).reduce<string[]>((entries, rumor) => {
    if (entries.length >= MAX_RUMORS) {
      return entries;
    }

    const normalized = normalizeOptionalString(rumor, MAX_RUMOR_LENGTH);
    if (!normalized) {
      return entries;
    }

    const dedupeKey = normalized.toLocaleLowerCase();
    if (rumorKeys.has(dedupeKey)) {
      return entries;
    }

    rumorKeys.add(dedupeKey);
    entries.push(normalized);
    return entries;
  }, []);

  const suggestedCodexUnlocks = (value.suggested_codex_unlocks ?? []).reduce<string[]>((entries, unlock) => {
    if (entries.length >= MAX_CODEX_UNLOCKS) {
      return entries;
    }

    const normalized = normalizeOptionalString(unlock, MAX_CODEX_LENGTH);
    if (!normalized) {
      return entries;
    }

    const dedupeKey = normalized.toLocaleLowerCase();
    if (codexKeys.has(dedupeKey)) {
      return entries;
    }

    codexKeys.add(dedupeKey);
    entries.push(normalized);
    return entries;
  }, []);

  const notableEnvironmentChanges = (value.notable_environment_changes ?? []).reduce<string[]>((entries, note) => {
    if (entries.length >= MAX_ENVIRONMENT_CHANGES) {
      return entries;
    }

    const normalized = normalizeOptionalString(note, MAX_ENVIRONMENT_NOTE_LENGTH);
    if (!normalized) {
      return entries;
    }

    const dedupeKey = normalized.toLocaleLowerCase();
    if (environmentKeys.has(dedupeKey)) {
      return entries;
    }

    environmentKeys.add(dedupeKey);
    entries.push(normalized);
    return entries;
  }, []);

  return {
    newNpcs,
    newSceneObjects,
    rumorsOrTensions,
    suggestedCodexUnlocks,
    notableEnvironmentChanges,
  };
}

export function stripStageStateBlockFromResponse(rawResponse: string): string {
  const extraction = extractStageStateBlock(rawResponse);
  return extraction.wellFormed ? extraction.strippedResponse : rawResponse;
}

export function promoteSoftFactsToChatState(
  initState: StageInitState,
  chatState: StageChatState,
  block: NormalizedLlmStageStateBlock,
): StageChatState {
  const knownCodexIds = new Set([
    ...initState.mapDef.locations.map((location) => location.codexEntryId),
    ...initState.mapDef.worldFacts.map((entry) => entry.id),
  ]);

  return {
    ...chatState,
    discoveredLoreEntries: block.suggestedCodexUnlocks.reduce((entries, candidate) => {
      return knownCodexIds.has(candidate) ? ensureArrayIncludes(entries, candidate) : entries;
    }, [...chatState.discoveredLoreEntries]),
  };
}
