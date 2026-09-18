import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
} from "@solana-mobile/wallet-adapter-mobile";
import { Capacitor } from "@capacitor/core";
import bs58 from "bs58";

const APP_URL = "https://seekerpulse.xyz";

export interface ConnectedWallet {
  address: string;
}

let adapter: SolanaMobileWalletAdapter | null = null;

function isAndroidCapacitor(): boolean {
  return Capacitor.getPlatform() === "android"
    || /Capacitor/i.test(navigator.userAgent)
    || window.location.protocol === "capacitor:";
}

function getAdapter(): SolanaMobileWalletAdapter {
  if (!adapter) {
    adapter = new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: "Seeker Pulse",
        uri: APP_URL,
        icon: `${APP_URL}/assets/pulse-icon-192.png`,
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster: "mainnet-beta",
      onWalletNotFound: async () => undefined,
    });
  }
  return adapter;
}

export function walletAvailable(): boolean {
  return isAndroidCapacitor();
}

export function walletAddress(): string | null {
  return getAdapter().publicKey?.toBase58() ?? null;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  if (!walletAvailable()) {
    throw new Error("Wallet connection is available in the Android app.");
  }
  const wallet = getAdapter();
  await wallet.autoConnect();
  if (!wallet.connected) await wallet.connect();
  const address = wallet.publicKey?.toBase58();
  if (!address) throw new Error("The wallet did not return an address.");
  return { address };
}

export async function disconnectWallet(): Promise<void> {
  if (adapter?.connected) await adapter.disconnect();
}

export async function signWalletMessage(message: string): Promise<string> {
  const wallet = getAdapter();
  if (!wallet.connected) throw new Error("Connect your wallet before signing in.");
  const signature = await wallet.signMessage(new TextEncoder().encode(message));
  return bs58.encode(signature);
}
