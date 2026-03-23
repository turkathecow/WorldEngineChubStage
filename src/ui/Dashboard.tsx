import { DashboardViewModel } from "../engine/types";
import { InventoryPanel } from "./InventoryPanel";
import { LocationPanel } from "./LocationPanel";
import { MapPanel } from "./MapPanel";
import { QuestPanel } from "./QuestPanel";
import { ReputationPanel } from "./ReputationPanel";
import { StatusPanel } from "./StatusPanel";
import { TopBar } from "./TopBar";
import { WeatherPanel } from "./WeatherPanel";

interface DashboardProps {
  viewModel: DashboardViewModel;
  showMapPanel: boolean;
}

export function Dashboard({ viewModel, showMapPanel }: DashboardProps) {
  return (
    <main className="stage-shell">
      <TopBar
        dateLabel={viewModel.topLine.dateLabel}
        timeLabel={viewModel.topLine.timeLabel}
        season={viewModel.topLine.season}
        location={viewModel.topLine.location}
        region={viewModel.topLine.region}
        note={viewModel.engineNote}
      />
      <section className="dashboard-grid">
        <LocationPanel {...viewModel.location} />
        <WeatherPanel {...viewModel.weather} />
        <StatusPanel {...viewModel.status} />
        <InventoryPanel {...viewModel.inventory} />
        <ReputationPanel entries={viewModel.reputation} />
        <QuestPanel quests={viewModel.quests} />
        {showMapPanel ? (
          <MapPanel
            currentLocationName={viewModel.map.currentLocationName}
            adjacentLocations={viewModel.map.adjacentLocations}
          />
        ) : null}
      </section>
    </main>
  );
}
