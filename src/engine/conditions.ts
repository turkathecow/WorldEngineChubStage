import { FatigueBand, FatigueState, InjuryRealism, InjuryState } from "./types";

function bandForFatigue(value: number): FatigueBand {
  if (value < 25) {
    return "fresh";
  }
  if (value < 50) {
    return "worn";
  }
  if (value < 75) {
    return "tired";
  }
  return "spent";
}

export function adjustFatigue(fatigue: FatigueState, delta: number): FatigueState {
  const value = Math.max(0, Math.min(100, fatigue.value + delta));
  return {
    value,
    band: bandForFatigue(value),
  };
}

export function recoverFatigue(fatigue: FatigueState, restMinutes: number): FatigueState {
  const recovery = Math.floor(restMinutes / 20);
  return adjustFatigue(fatigue, -recovery);
}

export function maybeAddTravelStrain(
  injuries: InjuryState[],
  fatigue: FatigueState,
  injuryRealism: InjuryRealism,
): InjuryState[] {
  if (fatigue.value < 72) {
    return injuries;
  }
  const existing = injuries.find((injury) => injury.id === "travel-strain");
  if (existing) {
    return injuries.map((injury) =>
      injury.id === "travel-strain" && injury.severity === "minor"
        ? { ...injury, severity: "moderate", treatmentNeeded: true }
        : injury,
    );
  }
  return [
    ...injuries,
    {
      id: "travel-strain",
      label: "Travel strain",
      severity: injuryRealism === "high" ? "moderate" : "minor",
      treatmentNeeded: injuryRealism !== "low",
    },
  ];
}

export function recoverMinorInjuries(injuries: InjuryState[], restMinutes: number): InjuryState[] {
  if (restMinutes < 240) {
    return injuries;
  }
  return injuries.filter((injury) => injury.severity !== "minor");
}

export function formatFatigue(fatigue: FatigueState): string {
  return `${fatigue.band} (${fatigue.value}/100)`;
}
