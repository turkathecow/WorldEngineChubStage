import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_INITIAL, DEFAULT_MESSAGE, InitialData, StageBase } from "@chub-ai/stages-ts";
import InitData from "./assets/test-init.json";
import { StageChatState, StageConfig, StageInitState, StageMessageState } from "./engine/types";

interface TestLogEntry {
  kind: "user" | "system";
  content: string;
}

export interface TestStageRunnerProps {
  factory: (
    data: InitialData<StageInitState, StageChatState, StageMessageState, StageConfig>,
  ) => StageBase<StageInitState, StageChatState, StageMessageState, StageConfig>;
}

export function TestStageRunner({ factory }: TestStageRunnerProps) {
  const [stage] = useState(() =>
    factory({
      ...DEFAULT_INITIAL,
      ...(InitData as Partial<InitialData<StageInitState, StageChatState, StageMessageState, StageConfig>>),
    } as InitialData<StageInitState, StageChatState, StageMessageState, StageConfig>),
  );
  const [revision, setRevision] = useState(0);
  const [input, setInput] = useState("wait for an hour");
  const [responseInput, setResponseInput] = useState(
    [
      "The inn yard smells of wet straw and lamp oil as a ledger-keeper peers over the caravan manifests.",
      "[STAGE_STATE]",
      '{"new_npcs":[{"name":"Mira Vale","role":"Inn factor","locationHint":"Niria Village"}],"rumors_or_tensions":["Teamsters whisper about late caravans."],"new_scene_objects":[{"name":"Rain-darkened cargo ledger","locationHint":"Niria Village","portable":true}]}',
      "[/STAGE_STATE]",
    ].join("\n"),
  );
  const [promptBridge, setPromptBridge] = useState<string | null>(null);
  const [parsedResponse, setParsedResponse] = useState<string | null>(null);
  const [softFactsSnapshot, setSoftFactsSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<TestLogEntry[]>([]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  async function initialize() {
    const response = await stage.load();
    setError(response.error ?? null);
    refresh();
  }

  useEffect(() => {
    initialize().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Unknown initialization failure.");
    });
  }, []);

  async function submitMessage(content: string) {
    const response = await stage.beforePrompt({
      ...DEFAULT_MESSAGE,
      anonymizedId: "0",
      content,
      identity: `test-${Date.now()}`,
      isBot: false,
      isMain: true,
      promptForId: null,
    });

    if (response.messageState) {
      await stage.setState(response.messageState);
    }

    setPromptBridge(response.stageDirections ?? null);
    setError(response.error ?? null);
    setLog((previous) => [
      ...previous,
      { kind: "user", content },
      ...(response.systemMessage ? [{ kind: "system" as const, content: response.systemMessage }] : []),
    ]);
    refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage(input);
  }

  async function submitBotResponse(content: string) {
    const response = await stage.afterResponse({
      ...DEFAULT_MESSAGE,
      anonymizedId: "bot-0",
      content,
      identity: `bot-${Date.now()}`,
      isBot: true,
      isMain: true,
      promptForId: null,
    });

    if (response.messageState) {
      await stage.setState(response.messageState);
      setSoftFactsSnapshot(JSON.stringify(response.messageState.softFacts, null, 2));
    }

    setParsedResponse(response.modifiedMessage ?? content);
    setError(response.error ?? null);
    setLog((previous) => [...previous, { kind: "system", content: `parsed response: ${response.modifiedMessage ?? content}` }]);
    refresh();
  }

  return (
    <div className="dev-runner" data-revision={revision}>
      <aside className="dev-console">
        <h1>Local Runner</h1>
        <p className="muted">This runner can exercise both `beforePrompt` and `afterResponse` locally.</p>
        <form onSubmit={onSubmit}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} />
          <div className="button-row">
            <button type="submit">Run Turn</button>
            <button type="button" onClick={() => submitMessage("travel to Gursa")}>Travel Test</button>
            <button type="button" onClick={() => submitMessage("buy 2 trail rations")}>Shop Test</button>
            <button type="button" onClick={() => submitMessage("check inventory")}>Inspect Test</button>
          </div>
        </form>
        {error ? <div className="error-box">{error}</div> : null}
        <section className="panel-card">
          <p className="eyebrow">Prompt Bridge</p>
          <pre>{promptBridge ?? "No turn run yet."}</pre>
        </section>
        <section className="panel-card">
          <p className="eyebrow">Response Parser</p>
          <textarea value={responseInput} onChange={(event) => setResponseInput(event.target.value)} rows={8} />
          <div className="button-row">
            <button type="button" onClick={() => submitBotResponse(responseInput)}>Parse Bot Response</button>
          </div>
          <p className="muted">Runs the sample reply through `afterResponse`, strips the machine block, and stores validated soft facts.</p>
          <pre>{parsedResponse ?? "No bot response parsed yet."}</pre>
        </section>
        <section className="panel-card">
          <p className="eyebrow">Soft Facts</p>
          <pre>{softFactsSnapshot ?? "No extracted soft facts yet."}</pre>
        </section>
        <section className="panel-card">
          <p className="eyebrow">Runner Log</p>
          {log.length > 0 ? log.map((entry, index) => <p key={`${entry.kind}-${index}`}>{entry.kind}: {entry.content}</p>) : <p className="muted">No local turns yet.</p>}
        </section>
      </aside>
      <div className="dev-stage">{stage.render()}</div>
    </div>
  );
}
