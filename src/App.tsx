import { InitialData, ReactRunner } from "@chub-ai/stages-ts";
import { Stage } from "./Stage";
import { TestStageRunner } from "./TestRunner";
import { StageChatState, StageConfig, StageInitState, StageMessageState } from "./engine/types";

function App() {
  const isDev = import.meta.env.MODE === 'development';
  console.info(`Running in ${import.meta.env.MODE}`);
  const factory = (
    data: InitialData<StageInitState, StageChatState, StageMessageState, StageConfig>,
  ) => new Stage(data);

  return isDev ? <TestStageRunner factory={factory} /> : <ReactRunner factory={factory} />;
}

export default App
