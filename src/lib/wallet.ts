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
        icon: "/pulse-icon-512.png",
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster: "mainnet-beta",
      onWalletNotFound: async () => undefined,
    });
  }
  return adapter;
}

function logWalletState(wallet: SolanaMobileWalletAdapter, message: string): void {
  console.info(`[MWA] ${message}`, {
    readyState: wallet.readyState,
    connected: wallet.connected,
    connecting: wallet.connecting,
    publicKeyPresent: Boolean(wallet.publicKey),
  });
}

function logWalletError(message: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[MWA] ${message}`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }
  console.error(`[MWA] ${message}`, { name: typeof error, message: String(error) });
}

export function walletAvailable(): boolean {
  return isAndroidCapacitor();
}

export function walletAddress(): string | null {
  return getAdapter().publicKey?.toBase58() ?? null;
}

interface WalletEventSource {
  on(event: "connect", listener: () => void): void;
  on(event: "error", listener: (error: unknown) => void): void;
  removeListener(event: "connect", listener: () => void): void;
  removeListener(event: "error", listener: (error: unknown) => void): void;
}

function waitForWalletConnection(wallet: SolanaMobileWalletAdapter): Promise<void> {
  if (wallet.publicKey) return Promise.resolve();
  const events = wallet as unknown as WalletEventSource;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      events.removeListener("connect", onConnect);
      events.removeListener("error", onError);
    };
    const onConnect = () => {
      logWalletState(wallet, "connect event received");
      cleanup();
      resolve();
    };
    const onError = (error: unknown) => {
      logWalletError("error event received", error);
      cleanup();
      reject(error);
    };
    const timeout = setTimeout(() => {
      cleanup();
      logWalletState(wallet, "connection event timed out");
      reject(new Error(`MWA authorization timed out before returning an account (state: ${wallet.readyState}, connecting: ${wallet.connecting}).`));
    }, 12_000);
    events.on("connect", onConnect);
    events.on("error", onError);
  });
}

export async function connectWallet(): Promise<ConnectedWallet> {
  if (!walletAvailable()) {
    throw new Error("Wallet connection is available in the Android app.");
  }
  const wallet = getAdapter();
  logWalletState(wallet, "connect requested");
  if (wallet.readyState === "Unsupported") {
    throw new Error("MWA is unsupported in this Android WebView. Reinstall the latest APK and verify it is running on Android.");
  }
  if (!wallet.connected || !wallet.publicKey) {
    if (wallet.connected) await wallet.disconnect();
    const connection = waitForWalletConnection(wallet);
    console.info("[MWA] wallet.connect() started");
    try {
      await Promise.all([wallet.connect(), connection]);
      console.info("[MWA] wallet.connect() resolved");
    } catch (error) {
      logWalletError("wallet.connect() rejected", error);
      throw error;
    }
  }
  const address = wallet.publicKey?.toBase58();
  if (!address) throw new Error("MWA authorization returned no Solana account.");
  console.info("[MWA] authorization succeeded", {
    publicKey: address,
  });
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
