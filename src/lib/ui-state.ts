export interface LookupInputAutoFillState {
  connectedAddress: string | null;
  explicitUserIntent?: boolean;
}

export function shouldAutoFillLookupInput(state: LookupInputAutoFillState): boolean {
  if (!state.connectedAddress) return false;
  return Boolean(state.explicitUserIntent);
}
