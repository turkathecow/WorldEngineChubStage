import { MoneyWallet, StageInitState } from "./types";

export function copperToWallet(totalCopper: number, initState: StageInitState): MoneyWallet {
  const { copperPerSilver, silverPerGold, goldPerDiamond } = initState.worldDef.economyModelDef;

  let remaining = Math.max(0, totalCopper);
  const copperPerGold = copperPerSilver * silverPerGold;
  const copperPerDiamond = copperPerGold * goldPerDiamond;

  const diamond = Math.floor(remaining / copperPerDiamond);
  remaining -= diamond * copperPerDiamond;
  const gold = Math.floor(remaining / copperPerGold);
  remaining -= gold * copperPerGold;
  const silver = Math.floor(remaining / copperPerSilver);
  remaining -= silver * copperPerSilver;

  return {
    diamond,
    gold,
    silver,
    copper: remaining,
  };
}

export function walletToCopper(wallet: MoneyWallet, initState: StageInitState): number {
  const { copperPerSilver, silverPerGold, goldPerDiamond } = initState.worldDef.economyModelDef;
  const copperPerGold = copperPerSilver * silverPerGold;
  const copperPerDiamond = copperPerGold * goldPerDiamond;
  return (
    wallet.copper +
    wallet.silver * copperPerSilver +
    wallet.gold * copperPerGold +
    wallet.diamond * copperPerDiamond
  );
}

export function addMoney(wallet: MoneyWallet, deltaCopper: number, initState: StageInitState): MoneyWallet {
  return copperToWallet(walletToCopper(wallet, initState) + deltaCopper, initState);
}

export function canAfford(wallet: MoneyWallet, costCopper: number, initState: StageInitState): boolean {
  return walletToCopper(wallet, initState) >= costCopper;
}

export function subtractMoney(wallet: MoneyWallet, deltaCopper: number, initState: StageInitState): MoneyWallet | null {
  if (!canAfford(wallet, deltaCopper, initState)) {
    return null;
  }
  return copperToWallet(walletToCopper(wallet, initState) - deltaCopper, initState);
}

export function formatMoney(wallet: MoneyWallet): string {
  const parts = [
    wallet.diamond > 0 ? `${wallet.diamond}d` : null,
    wallet.gold > 0 ? `${wallet.gold}g` : null,
    wallet.silver > 0 ? `${wallet.silver}s` : null,
    wallet.copper > 0 || (wallet.diamond === 0 && wallet.gold === 0 && wallet.silver === 0)
      ? `${wallet.copper}c`
      : null,
  ].filter(Boolean);
  return parts.join(" ");
}
