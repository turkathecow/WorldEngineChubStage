import { ReactElement } from "react";
import { InitialData, LoadResponse, Message, StageBase, StageResponse } from "@chub-ai/stages-ts";
import { DEFAULT_SYSTEM_NOTE } from "./engine/defaults";
import { hydrateState, createInitState, normalizeConfig } from "./engine/initWorld";
import {
  extractStageStateBlock,
  normalizeStageStateBlock,
  parseStageStateBlock,
  promoteSoftFactsToChatState,
  validateStageStateBlock,
} from "./engine/llmStructuredState";
import { buildPromptBridge } from "./engine/promptBridge";
import { resolveUserTurn } from "./engine/resolveAction";
import { buildDashboardViewModel } from "./engine/selectors";
import { mergeSoftFactsIntoMessageState, synchronizeAll } from "./engine/reducers";
import { StageChatState, StageConfig, StageInitState, StageMessageState } from "./engine/types";
import { Dashboard } from "./ui/Dashboard";

export class Stage extends StageBase<StageInitState, StageChatState, StageMessageState, StageConfig> {
  private config: StageConfig;
  private initState: StageInitState;
  private chatState: StageChatState;
  private messageState: StageMessageState;
  private lastPromptBridge: string | null;

  constructor(data: InitialData<StageInitState, StageChatState, StageMessageState, StageConfig>) {
    super(data);
    this.config = normalizeConfig(data.config ?? data.initState?.config ?? null);
    this.initState = data.initState ?? createInitState(this.config);
    const hydrated = hydrateState(this.initState, data.messageState, data.chatState);
    this.chatState = hydrated.chatState;
    this.messageState = hydrated.messageState;
    this.lastPromptBridge = null;
  }

  async load(): Promise<Partial<LoadResponse<StageInitState, StageChatState, StageMessageState>>> {
    const hydrated = hydrateState(this.initState, this.messageState, this.chatState);
    this.messageState = hydrated.messageState;
    this.chatState = hydrated.chatState;

    return {
      success: true,
      error: null,
      initState: this.initState,
      chatState: this.chatState,
      messageState: this.messageState,
    };
  }

  async setState(state: StageMessageState): Promise<void> {
    if (state) {
      this.messageState = synchronizeAll(this.initState, state);
    }
  }

  async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<StageChatState, StageMessageState>>> {
    const resolution = resolveUserTurn(this.initState, this.messageState, this.chatState, userMessage.content);
    this.messageState = resolution.messageState;
    this.chatState = resolution.chatState;
    this.lastPromptBridge = buildPromptBridge(this.initState, this.messageState, this.chatState);

    return {
      stageDirections: this.lastPromptBridge,
      messageState: this.messageState,
      modifiedMessage: null,
      systemMessage: null,
      error: null,
      chatState: this.chatState,
    };
  }

  async afterResponse(botMessage: Message): Promise<Partial<StageResponse<StageChatState, StageMessageState>>> {
    const extraction = extractStageStateBlock(botMessage.content);
    const issues = [...extraction.issues];
    let modifiedMessage: string | null = extraction.wellFormed ? extraction.strippedResponse : null;

    if (extraction.wellFormed && extraction.jsonText !== null) {
      const parsed = parseStageStateBlock(extraction.jsonText);
      if (parsed.error) {
        issues.push(`Failed to parse STAGE_STATE JSON: ${parsed.error}`);
      } else {
        // The LLM can only suggest soft facts here, so the block is validated and normalized before anything is stored.
        const validated = validateStageStateBlock(parsed.value);
        issues.push(...validated.issues);

        if (validated.value) {
          const normalized = normalizeStageStateBlock(validated.value);
          // Hard state stays engine-owned. Only validated soft facts are merged here.
          this.messageState = synchronizeAll(
            this.initState,
            mergeSoftFactsIntoMessageState(this.messageState, normalized, botMessage.identity),
          );
          this.chatState = promoteSoftFactsToChatState(this.initState, this.chatState, normalized);
        }
      }
    }

    if (issues.length > 0) {
      console.warn("[Stage structured state]", issues.join(" "));
    }

    return {
      stageDirections: null,
      messageState: this.messageState,
      // The machine block is hidden after extraction so end users only see narrative text.
      modifiedMessage,
      error: null,
      systemMessage: null,
      chatState: this.chatState,
    };
  }

  render(): ReactElement {
    const viewModel = buildDashboardViewModel(this.initState, this.messageState, this.chatState);
    const note = viewModel.engineNote ?? DEFAULT_SYSTEM_NOTE;
    return (
      <Dashboard
        viewModel={{
          ...viewModel,
          engineNote: note,
        }}
        showMapPanel={this.config.showMapPanel}
      />
    );
  }
}
