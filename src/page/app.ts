import { connectWallet, disconnectWallet, signWalletMessage, walletAddress, walletAvailable } from "../lib/wallet.js";
import { shouldAutoFillLookupInput } from "../lib/ui-state.js";
import { Capacitor } from "@capacitor/core";
import { PublicKey } from "@solana/web3.js";

type Verdict = "aligned" | "watch" | "at_risk" | "idle";
interface Category { id: string; label: string; verdict: Verdict; detail: string; value: number; unit: string; }
interface Suggestion { text: string; }
interface DetectedDapp { dapp: { id: string; name: string; iconUrl: string | null; deepLink: string | null; categories: Array<{ name: string; slug: string }>; isVerified: boolean }; interactions: number; lastUsedAt: string; }
interface RecentSource { source: string; count: number; lastUsedAt: string; }
interface LookupData { address: string; skrDomain: string | null; isSeekerWallet: boolean; detectedDapps: DetectedDapp[]; activity: { todayCount: number; streak: number; uniqueDapps: number; topSources: RecentSource[] }; scorecard: { overallVerdict: Verdict; pulseScore: number; categories: Category[]; suggestions: Suggestion[] }; nextResetUtc: string; }
interface DomainSuggestionResponse { domains: Array<{ domain: string | null; address: string }>; }
interface DappRecommendation { dapp: { id: string; name: string; shortDescription: string | null; description: string | null; deepLink: string | null; iconUrl: string | null; rating: number | null; reviewCount: number | null; pulseScore: number | null }; reason: string; relevance: number; }
interface DappFinderResponse { answer: string; recommendations: DappRecommendation[]; }
interface DappListResponse { dapps: DappRecommendation["dapp"][]; count: number; }
interface VersionManifest { version: string; packageName: string; updateUrl: string; }

const APP_VERSION = "1.0.3";
const APP_PACKAGE_NAME = "xyz.seekerpulse";
const APP_UPDATE_URL = `solanadappstore://details?id=${APP_PACKAGE_NAME}`;

const form = document.getElementById("lookup-form") as HTMLFormElement;
const input = document.getElementById("lookup-input") as HTMLInputElement;
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const formError = document.getElementById("form-error") as HTMLDivElement;
const loadingEl = document.getElementById("loading") as HTMLElement;
const resultEl = document.getElementById("result") as HTMLElement;
const identityBanner = document.getElementById("identity-banner") as HTMLElement;
const ringsGrid = document.getElementById("rings-grid") as HTMLElement;
const verdictBanner = document.getElementById("verdict-banner") as HTMLElement;
const pulseScore = document.getElementById("pulse-score") as HTMLElement;
const missionList = document.getElementById("mission-list") as HTMLUListElement;
const detectedDapps = document.getElementById("detected-dapps") as HTMLElement;
const detectedCategories = document.getElementById("detected-categories") as HTMLElement;
const suggestionsList = document.getElementById("suggestions-list") as HTMLUListElement;
const metaAddress = document.getElementById("meta-address") as HTMLElement;
const metaCountdown = document.getElementById("meta-countdown") as HTMLElement;
const domainSuggestions = document.getElementById("domain-suggestions") as HTMLDivElement;
const dappChatForm = document.getElementById("dapp-chat-form") as HTMLFormElement;
const dappChatInput = document.getElementById("dapp-chat-input") as HTMLTextAreaElement;
const dappChatSubmit = document.getElementById("dapp-chat-submit") as HTMLButtonElement;
const menuButton = document.getElementById("menu-button") as HTMLButtonElement;
const sidebar = document.getElementById("site-sidebar") as HTMLElement;
const sidebarBackdrop = document.getElementById("sidebar-backdrop") as HTMLDivElement;
const sidebarClose = document.getElementById("sidebar-close") as HTMLButtonElement;
const dappChatStatus = document.getElementById("dapp-chat-status") as HTMLDivElement;
const dappChatLoading = document.getElementById("dapp-chat-loading") as HTMLDivElement;
const dappChatResults = document.getElementById("dapp-chat-results") as HTMLDivElement;
const dappPrompts = Array.from(document.querySelectorAll<HTMLButtonElement>(".dapp-prompt"));
const dappChat = document.getElementById("dapp-chat") as HTMLElement;
const dappLoadMore = document.getElementById("dapp-load-more") as HTMLButtonElement;
const walletConnect = document.getElementById("wallet-connect") as HTMLButtonElement;
const appVersion = document.getElementById("app-version") as HTMLElement;
const appUpdate = document.getElementById("app-update") as HTMLButtonElement;
const walletConnectLabel = document.getElementById("wallet-connect-label") as HTMLElement;
const walletConnectStatus = document.getElementById("wallet-connect-status") as HTMLElement;
const walletActions = document.getElementById("wallet-actions") as HTMLElement;
const walletCopy = document.getElementById("wallet-copy") as HTMLButtonElement;
const walletDisconnect = document.getElementById("wallet-disconnect") as HTMLButtonElement;
const useConnectedWalletBtn = document.getElementById("use-connected-wallet-btn") as HTMLButtonElement;
const pulseMode = document.getElementById("pulse-mode") as HTMLButtonElement;
const lookupMode = document.getElementById("lookup-mode") as HTMLButtonElement;
const catalogMode = document.getElementById("catalog-mode") as HTMLButtonElement;
const heroTitle = document.getElementById("hero-title") as HTMLElement;
const heroSub = document.getElementById("hero-sub") as HTMLElement;
const pulseView = document.getElementById("pulse-view") as HTMLElement;
const pulseDashboard = document.getElementById("pulse-dashboard") as HTMLElement;
const pulseViewTitle = document.getElementById("pulse-view-title") as HTMLElement;
const pulseViewIntro = document.getElementById("pulse-view-intro") as HTMLElement;
const pulseIdentity = document.getElementById("pulse-identity") as HTMLElement;
const pulseDashboardScore = document.getElementById("pulse-dashboard-score") as HTMLElement;
const pulseDashboardToday = document.getElementById("pulse-dashboard-today") as HTMLElement;
const pulseDashboardStreak = document.getElementById("pulse-dashboard-streak") as HTMLElement;
const pulseDashboardDapps = document.getElementById("pulse-dashboard-dapps") as HTMLElement;
const pulseDashboardSkr = document.getElementById("pulse-dashboard-skr") as HTMLElement;
const pulseTodayAction = document.getElementById("pulse-today-action") as HTMLElement;
const pulseJourney = document.getElementById("pulse-journey") as HTMLElement;
const pulseMissionList = document.getElementById("pulse-mission-list") as HTMLUListElement;
const pulseProgressLabel = document.getElementById("pulse-progress-label") as HTMLElement;
const pulseProgressBar = document.getElementById("pulse-progress-bar") as HTMLElement;
const pulseRecentActivity = document.getElementById("pulse-recent-activity") as HTMLElement;
const pulseAchievements = document.getElementById("pulse-achievements") as HTMLElement;
const pulseRecommendations = document.getElementById("pulse-recommendations") as HTMLElement;
const pulseNextAction = document.getElementById("pulse-next-action") as HTMLButtonElement;
const mobilePulse = document.getElementById("mobile-pulse") as HTMLButtonElement;
const mobileLookup = document.getElementById("mobile-lookup") as HTMLButtonElement;
const mobileDiscover = document.getElementById("mobile-discover") as HTMLButtonElement;
const mobileNav = document.getElementById("mobile-nav") as HTMLElement;
let currentCatalogQuery = "";
let currentCatalogOffset = 0;
let catalogLoading = false;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let suggestionRequest: ReturnType<typeof setTimeout> | null = null;
let suggestionRequestId = 0;
const isCapacitorApp = Capacitor.getPlatform() === "android"
  || /Capacitor/i.test(navigator.userAgent)
  || window.location.protocol === "capacitor:";
const apiBase = isCapacitorApp
  ? "https://seekerpulse.xyz"
  : "";

let connectedAddress: string | null = walletAddress();
let connectedSkrDomain: string | null = null;
let sessionToken = connectedAddress ? sessionStorage.getItem("seeker-pulse-session") : null;
if (!connectedAddress) sessionStorage.removeItem("seeker-pulse-session");
let hasLookupResult = false;

appVersion.textContent = `v${APP_VERSION}`;
appUpdate.addEventListener("click", () => { window.location.href = APP_UPDATE_URL; });

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index++) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function checkForAppUpdate(): Promise<void> {
  if (!isCapacitorApp) return;
  try {
    const response = await fetch(`https://seekerpulse.xyz/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json() as VersionManifest;
    if (manifest.packageName !== APP_PACKAGE_NAME || !manifest.version || compareVersions(manifest.version, APP_VERSION) <= 0) return;
    appUpdate.hidden = false;
    appUpdate.title = `Version ${manifest.version} is available`;
  } catch {
    // Update checks are best effort and must not block the app.
  }
}

function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

function renderWalletButton(): void {
  walletConnect.hidden = !walletAvailable() && !connectedAddress;
  walletConnect.classList.toggle("connected", Boolean(connectedAddress));
  walletConnect.title = connectedAddress ? "Open wallet options" : "Connect wallet";
  walletConnect.setAttribute("aria-label", connectedAddress ? "Open wallet options" : "Connect wallet");
  walletConnectLabel.textContent = connectedAddress
    ? connectedSkrDomain || "No .skr identity"
    : "Connect wallet";
  walletConnectStatus.textContent = connectedAddress
    ? shortenAddress(connectedAddress)
    : "";
  if (useConnectedWalletBtn) {
    useConnectedWalletBtn.hidden = !connectedAddress;
    useConnectedWalletBtn.disabled = !connectedAddress;
  }
  walletActions.hidden = !connectedAddress;
  syncPulseAvailability();
}

function syncPulseAvailability(): void {
  const pulseAvailable = Boolean(connectedAddress && sessionToken);
  pulseMode.hidden = !pulseAvailable;
  mobilePulse.hidden = !pulseAvailable;
  mobileNav.classList.toggle("is-compact", !pulseAvailable);
  if (!pulseAvailable && pulseMode.classList.contains("active")) setMode("lookup");
}

walletConnect.addEventListener("click", async () => {
  if (connectedAddress) {
    walletActions.hidden = !walletActions.hidden;
    return;
  }
  walletConnect.disabled = true;
  walletConnectLabel.textContent = "Opening wallet...";
  walletConnectStatus.textContent = "Approve in your wallet";
  try {
    const wallet = connectedAddress ? { address: connectedAddress } : await connectWallet();
    connectedAddress = wallet.address;
    console.info("[MWA] connected address:", wallet.address);
    await authenticateWallet(wallet.address);
    renderWalletButton();
    setMode("pulse");
    await loadConnectedWalletSnapshot(wallet.address);
    setSidebar(false);
    if (shouldAutoFillLookupInput({ connectedAddress: wallet.address, explicitUserIntent: false })) {
      input.value = wallet.address;
      form.requestSubmit();
    }
  } catch (error) {
    formError.textContent = error instanceof Error ? error.message : "Wallet connection failed.";
    formError.hidden = false;
    renderWalletButton();
  } finally {
    walletConnect.disabled = false;
  }
});

walletDisconnect.addEventListener("click", async () => {
  walletDisconnect.disabled = true;
  try {
    await disconnectWallet();
    connectedAddress = null;
    connectedSkrDomain = null;
    sessionToken = null;
    sessionStorage.removeItem("seeker-pulse-session");
    pulseDashboard.hidden = true;
    walletActions.hidden = true;
    setMode("lookup");
    renderWalletButton();
  } catch (error) {
    formError.textContent = error instanceof Error ? error.message : "Wallet disconnect failed.";
    formError.hidden = false;
  } finally {
    walletDisconnect.disabled = false;
  }
});

walletCopy.addEventListener("click", async () => {
  if (!connectedAddress) return;
  try {
    await navigator.clipboard.writeText(connectedAddress);
    walletCopy.textContent = "Copied";
    window.setTimeout(() => { walletCopy.textContent = "Copy address"; }, 1400);
  } catch {
    walletCopy.textContent = "Copy unavailable";
    window.setTimeout(() => { walletCopy.textContent = "Copy address"; }, 1400);
  }
});

async function loadConnectedWalletSnapshot(address: string): Promise<void> {
  try {
    const response = await fetch(apiUrl(`/api/lookup?q=${encodeURIComponent(address)}`));
    const data = await readJson<LookupData>(response);
    if (!response.ok) throw new Error(data.error || "Connected wallet identity unavailable.");
    connectedSkrDomain = data.skrDomain;
    renderWalletButton();
    renderPulseDashboard(data);
  } catch (error) {
    console.warn("[Pulse] connected wallet snapshot unavailable:", error);
    renderWalletButton();
  }
}

async function authenticateWallet(address: string): Promise<void> {
  const challengeResponse = await fetch(apiUrl(`/api/auth/wallet?address=${encodeURIComponent(address)}`));
  const challenge = await readJson<{ nonce: string; message: string }>(challengeResponse);
  if (!challengeResponse.ok) throw new Error(challenge.error || "Could not start wallet sign-in.");
  const signature = await signWalletMessage(challenge.message);
  const verifyResponse = await fetch(apiUrl("/api/auth/wallet"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, nonce: challenge.nonce, signature }),
  });
  const verified = await readJson<{ token: string }>(verifyResponse);
  if (!verifyResponse.ok) throw new Error(verified.error || "Wallet sign-in failed.");
  sessionToken = verified.token;
  sessionStorage.setItem("seeker-pulse-session", sessionToken);
  await loadMissionState();
}

async function loadMissionState(): Promise<void> {
  if (!sessionToken) return;
  try {
    const response = await fetch(apiUrl("/api/missions"), { headers: { Authorization: `Bearer ${sessionToken}` } });
    const data = await readJson<{ missions: Array<{ title: string; description: string; target: number; progress: number; completedAt: string | null }>; achievements: Array<{ title: string; description: string; awardedAt: string }>; journey?: { weeklyExplorationCount: number; mostExplored: Array<{ dappId: string; name: string; count: number; category: string; lastOpenedAt: string }>; recentlyExplored: Array<{ dappId: string; name: string; label: string; category: string; lastOpenedAt: string }>; categories: Array<{ name: string; count: number; totalOpens: number }>; newDiscoveries: number; nextMove: string } }>(response);
    if (!response.ok) throw new Error(data.error || "Mission state unavailable.");
    if (data.missions.length > 0) {
      const completed = data.missions.filter((mission) => mission.completedAt).length;
      pulseProgressLabel.textContent = `${completed} / ${data.missions.length}`;
      pulseProgressBar.style.width = `${Math.round((completed / data.missions.length) * 100)}%`;
      pulseMissionList.replaceChildren(...data.missions.map((mission) => {
        const item = document.createElement("li");
        item.className = mission.completedAt ? "mission-complete" : "";
        item.textContent = `${mission.completedAt ? "✓" : "○"} ${mission.title}`;
        return item;
      }));
    }
    if (data.journey) {
      renderJourneySummary(data.journey);
    }
    pulseAchievements.replaceChildren();
    if (data.achievements.length === 0) {
      pulseAchievements.textContent = "Complete verified Pulse actions to unlock achievements.";
      return;
    }
    for (const achievement of data.achievements) {
      const item = document.createElement("div");
      item.className = "pulse-achievement";
      item.innerHTML = `<strong>${escapeHtml(achievement.title)}</strong><span>${escapeHtml(achievement.description)}</span>`;
      pulseAchievements.append(item);
    }
  } catch {
    pulseAchievements.textContent = "Achievements will appear after wallet progress is available.";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

renderWalletButton();
void checkForAppUpdate();

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`The API returned a non-JSON response (HTTP ${response.status}). Check the hosted API URL.`);
  }
  return await response.json() as T & { error?: string };
}

menuButton.addEventListener("click", () => setSidebar(true));
sidebarClose.addEventListener("click", () => setSidebar(false));
sidebarBackdrop.addEventListener("click", () => setSidebar(false));
sidebar.querySelector("a")?.addEventListener("click", () => setSidebar(false));

function setSidebar(open: boolean): void {
  sidebar.classList.toggle("open", open);
  sidebar.setAttribute("aria-hidden", String(!open));
  menuButton.setAttribute("aria-expanded", String(open));
  sidebarBackdrop.hidden = !open;
  document.body.classList.toggle("sidebar-open", open);
}

 pulseMode.addEventListener("click", () => setMode("pulse"));
lookupMode.addEventListener("click", () => setMode("lookup"));
catalogMode.addEventListener("click", () => setMode("catalog"));
mobilePulse.addEventListener("click", () => setMode("pulse"));
mobileLookup.addEventListener("click", () => setMode("lookup"));
mobileDiscover.addEventListener("click", () => setMode("catalog"));
pulseNextAction.addEventListener("click", () => setMode("catalog"));
dappLoadMore.addEventListener("click", loadMoreDapps);
useConnectedWalletBtn?.addEventListener("click", () => {
  if (!connectedAddress) return;
  input.value = connectedAddress;
  input.focus();
  const explicitIntent = shouldAutoFillLookupInput({ connectedAddress, explicitUserIntent: true });
  if (explicitIntent) {
    form.requestSubmit();
  }
});
dappPrompts.forEach((prompt) => prompt.addEventListener("click", () => {
  dappChatInput.value = prompt.dataset.prompt || "";
  dappChatInput.focus();
}));

function setMode(mode: "pulse" | "lookup" | "catalog"): void {
  const pulseActive = mode === "pulse" && Boolean(connectedAddress && sessionToken);
  const effectiveMode = pulseActive ? "pulse" : mode === "pulse" ? "lookup" : mode;
  const catalogActive = effectiveMode === "catalog";
  pulseMode.classList.toggle("active", pulseActive);
  lookupMode.classList.toggle("active", effectiveMode === "lookup");
  catalogMode.classList.toggle("active", catalogActive);
  mobilePulse.classList.toggle("active", pulseActive);
  mobileLookup.classList.toggle("active", effectiveMode === "lookup");
  mobileDiscover.classList.toggle("active", catalogActive);
  pulseMode.setAttribute("aria-selected", String(pulseActive));
  lookupMode.setAttribute("aria-selected", String(effectiveMode === "lookup"));
  catalogMode.setAttribute("aria-selected", String(catalogActive));
  pulseView.hidden = !pulseActive;
  form.hidden = pulseActive || catalogActive;
  dappChat.hidden = !catalogActive;
  resultEl.hidden = pulseActive || catalogActive || !hasLookupResult;
  formError.hidden = true;
  loadingEl.hidden = true;
  dappChatResults.hidden = true;
  dappChatStatus.hidden = true;
  dappLoadMore.hidden = true;
  if (pulseActive) {
    heroTitle.textContent = connectedAddress ? "Your Seeker, in motion." : "Your daily Seeker companion.";
    heroSub.textContent = connectedAddress ? "A clear view of your identity, activity, and next move across the Seeker ecosystem." : "Connect your wallet to see your identity, today's progress, and your next move.";
  } else if (catalogActive) {
    heroTitle.textContent = "What are you looking for?";
    heroSub.textContent = "Describe the Seeker dApp you need and Pulse will search the verified catalog for relevant matches.";
    dappChatInput.focus();
  } else {
    heroTitle.textContent = "Where do you land today?";
    heroSub.innerHTML = "Check a <code>.skr</code> identity and explore a public Pulse readout. Your connected wallet stays separate.";
    input.focus();
  }
}

setMode(connectedAddress && sessionToken ? "pulse" : "lookup");

dappChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = dappChatInput.value.trim();
  if (!message) return;
  currentCatalogQuery = message;
  currentCatalogOffset = 0;
  dappChatSubmit.disabled = true;
  dappChatLoading.hidden = false;
  dappChatStatus.hidden = false;
  dappChatStatus.textContent = "Searching the verified catalog…";
  dappChatResults.hidden = true;
  try {
    const response = await fetch(apiUrl("/api/ai/dapp-finder"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const data = await readJson<DappFinderResponse>(response);
    if (!response.ok) throw new Error(data.error || "Recommendation search failed.");
    renderDappRecommendations(data);
  } catch (error) {
    dappChatStatus.textContent = error instanceof Error ? error.message : "Recommendation search failed.";
  } finally {
    dappChatLoading.hidden = true;
    dappChatSubmit.disabled = false;
  }
});

async function loadMoreDapps(): Promise<void> {
  if (catalogLoading || !currentCatalogQuery) return;
  catalogLoading = true;
  dappLoadMore.disabled = true;
  dappLoadMore.textContent = "Loading…";
  try {
    const params = new URLSearchParams({ query: currentCatalogQuery, active: "true", seekerCompatible: "true", limit: "10", offset: String(currentCatalogOffset + 5), sort: "pulseScore" });
    const response = await fetch(apiUrl(`/api/dapps?${params}`));
    const data = await readJson<DappListResponse>(response);
    if (!response.ok) throw new Error(data.error || "Could not load more dApps.");
    appendDappRecords(data.dapps);
    currentCatalogOffset += data.dapps.length;
    dappLoadMore.hidden = data.dapps.length < 10;
  } catch (error) {
    dappChatStatus.textContent = error instanceof Error ? error.message : "Could not load more dApps.";
  } finally {
    catalogLoading = false;
    dappLoadMore.disabled = false;
    dappLoadMore.textContent = "Load more dApps";
  }
}

input.addEventListener("input", () => scheduleDomainSuggestions(input.value));
input.addEventListener("focus", () => scheduleDomainSuggestions(input.value));
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideDomainSuggestions();
});
document.addEventListener("click", (event) => {
  if (!form.contains(event.target as Node)) hideDomainSuggestions();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  const lookupQuery = normalizeLookupQuery(query);
  setLoading(true); formError.hidden = true; resultEl.hidden = true;
  try {
    const lookupUrl = apiUrl(`/api/lookup?q=${encodeURIComponent(lookupQuery)}`);
    console.info("[Pulse] lookup request:", lookupUrl);
    const response = await fetch(lookupUrl);
    console.info("[Pulse] lookup response:", { status: response.status, ok: response.ok });
    const data = await readJson<LookupData>(response);
    if (!response.ok) throw new Error(data.error || "Lookup failed.");
    hideDomainSuggestions();
    render(data);
  } catch (error) { formError.textContent = error instanceof Error ? error.message : "Lookup failed."; formError.hidden = false; }
  finally { setLoading(false); }
});

function normalizeLookupQuery(query: string): string {
  try {
    return new PublicKey(query).toBase58();
  } catch {
    // Continue with .skr domain normalization for non-address input.
  }
  const name = query.toLowerCase();
  return /^[a-z0-9-]{2,63}$/.test(name) ? `${name}.skr` : query;
}

function scheduleDomainSuggestions(value: string): void {
  if (suggestionRequest) clearTimeout(suggestionRequest);
  const requestId = ++suggestionRequestId;
  suggestionRequest = setTimeout(() => loadDomainSuggestions(value, requestId), 350);
}

async function loadDomainSuggestions(value: string, requestId: number): Promise<void> {
  const normalized = value.trim().toLowerCase().replace(/\.skr$/, "");
  if (!/^[a-z0-9-]{2,63}$/.test(normalized)) {
    hideDomainSuggestions();
    return;
  }

  try {
    const response = await fetch(apiUrl(`/api/domain-suggestions?name=${encodeURIComponent(normalized)}`));
    const data = await readJson<DomainSuggestionResponse>(response);
    if (requestId !== suggestionRequestId || input.value.trim().toLowerCase().replace(/\.skr$/, "") !== normalized) return;
    renderDomainSuggestions(data.domains.map((suggestion) => suggestion.domain).filter((domain): domain is string => Boolean(domain)));
  } catch {
    if (requestId === suggestionRequestId) hideDomainSuggestions();
  }
}

function renderDomainSuggestions(domains: string[]): void {
  domainSuggestions.innerHTML = "";
  if (domains.length === 0) {
    hideDomainSuggestions();
    return;
  }

  for (const domain of domains) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "domain-suggestion";
    option.setAttribute("role", "option");
    option.textContent = domain;
    option.addEventListener("click", () => {
      input.value = domain;
      hideDomainSuggestions();
      input.focus();
    });
    domainSuggestions.appendChild(option);
  }
  domainSuggestions.hidden = false;
}

function hideDomainSuggestions(): void {
  domainSuggestions.hidden = true;
}

function setLoading(isLoading: boolean): void { loadingEl.hidden = !isLoading; scanBtn.disabled = isLoading; }
function render(data: LookupData): void {
  hasLookupResult = true;
  if (connectedAddress && data.address === connectedAddress) {
    connectedSkrDomain = data.skrDomain;
    renderWalletButton();
  }
  renderPulseDashboard(data);
  renderBanner(data); pulseScore.textContent = String(data.scorecard.pulseScore); renderCategories(data.scorecard.categories); renderDetectedDapps(data.detectedDapps); renderSuggestions(data.scorecard.suggestions); renderMissions(data); metaAddress.textContent = data.skrDomain || shortenAddress(data.address); startCountdown(data.nextResetUtc); resultEl.hidden = false; resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPulseDashboard(data: LookupData): void {
  pulseDashboard.hidden = false;
  pulseViewTitle.textContent = "Your Seeker, in motion.";
  pulseViewIntro.textContent = "Your connected wallet is the source for this personalized activity view.";
  pulseIdentity.textContent = data.skrDomain || shortenAddress(data.address);
  pulseDashboardScore.textContent = String(data.scorecard.pulseScore);
  pulseDashboardToday.textContent = String(data.activity.todayCount);
  pulseDashboardStreak.textContent = String(data.activity.streak);
  pulseDashboardDapps.textContent = String(data.detectedDapps.length);
  pulseDashboardSkr.textContent = "...";
  const missions = buildMissionState(data);
  const completedMissions = missions.filter((mission) => mission.complete).length;
  pulseProgressLabel.textContent = `${completedMissions} / ${missions.length}`;
  pulseProgressBar.style.width = `${Math.round((completedMissions / missions.length) * 100)}%`;
  pulseMissionList.replaceChildren(...renderMissionItems(missions));
  renderRecentActivity(data.activity.topSources);
  void loadSkrBalance(data.address);
  const dappAction = data.detectedDapps.length === 0
    ? "Explore a verified app in dApp Finder to start building your ecosystem map."
    : `Explore ${data.detectedDapps[0].dapp.name} again, or discover a new verified app in dApp Finder.`;
  pulseTodayAction.textContent = data.activity.todayCount === 0 ? `Your Pulse is waiting for today's first meaningful action. ${dappAction}` : dappAction;
  pulseRecommendations.textContent = "Loading verified matches...";
  void loadPersonalizedDapps(data.detectedDapps);
  void loadMissionState();
}

async function loadPersonalizedDapps(usedDapps: DetectedDapp[]): Promise<void> {
  const usedIds = new Set(usedDapps.map((record) => record.dapp.id));
  const category = usedDapps.flatMap((record) => record.dapp.categories)[0]?.slug;
  const params = new URLSearchParams({ active: "true", seekerCompatible: "true", limit: "50", sort: "pulseScore" });
  if (category) params.set("category", category);
  try {
    const response = await fetch(apiUrl(`/api/dapps?${params}`));
    const data = await readJson<DappListResponse>(response);
    if (!response.ok) throw new Error(data.error || "Recommendation search failed.");
    const candidates = data.dapps.filter((dapp) => !usedIds.has(dapp.id));
    const recommendations = rotateDailyRecommendations(candidates);
    renderPulseRecommendations(recommendations);
  } catch {
    pulseRecommendations.textContent = "Recommendations are temporarily unavailable.";
  }
}

function rotateDailyRecommendations(dapps: DappListResponse["dapps"]): DappListResponse["dapps"] {
  if (dapps.length <= 3) return dapps;
  const day = Math.floor(Date.now() / 86400000);
  const start = day % dapps.length;
  return Array.from({ length: 3 }, (_, index) => dapps[(start + index) % dapps.length]);
}

function renderPulseRecommendations(dapps: DappListResponse["dapps"]): void {
  pulseRecommendations.replaceChildren();
  if (dapps.length === 0) {
    pulseRecommendations.textContent = "Explore a few verified dApps and Pulse will tailor this list.";
    return;
  }
  for (const dapp of dapps) {
    const item = document.createElement("article");
    item.className = "pulse-recommendation";
    const title = document.createElement("strong");
    title.textContent = dapp.name;
    const description = document.createElement("span");
    description.textContent = dapp.shortDescription || dapp.description || "Verified Seeker catalog app.";
    item.append(title, description);
    if (dapp.deepLink) {
      const link = document.createElement("a");
      link.href = dapp.deepLink;
      link.textContent = "Open";
      link.className = "pulse-recommendation-link";
      link.addEventListener("click", () => {
        void recordDappExploration(dapp.id);
      });
      item.append(link);
    }
    pulseRecommendations.append(item);
  }
}

async function recordDappExploration(dappId: string): Promise<void> {
  if (!sessionToken || !dappId) return;
  try {
    await fetch(apiUrl("/api/pulse/explore"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ dappId }),
    });
  } catch {
    // Exploration tracking is best effort and must never disrupt the main UX.
  }
}

async function loadSkrBalance(address: string): Promise<void> {
  try {
    const response = await fetch(apiUrl(`/api/wallet/skr?address=${encodeURIComponent(address)}`));
    const data = await readJson<{ balance: string }>(response);
    pulseDashboardSkr.textContent = response.ok ? formatTokenBalance(data.balance) : "—";
  } catch {
    pulseDashboardSkr.textContent = "—";
  }
}

function formatTokenBalance(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount >= 1000 ? `${(amount / 1000).toFixed(1)}K` : amount.toFixed(2);
}

interface MissionState { label: string; complete: boolean; }

function buildMissionState(data: LookupData): MissionState[] {
  return [
    { label: "Connect your wallet", complete: Boolean(connectedAddress && sessionToken) },
    { label: "Explore a verified dApp", complete: data.detectedDapps.length > 0 },
    { label: "Complete an on-chain activity", complete: data.activity.todayCount > 0 },
  ];
}

function renderMissionItems(missions: MissionState[]): HTMLLIElement[] {
  return missions.map((mission) => {
    const item = document.createElement("li");
    item.className = mission.complete ? "mission-complete" : "";
    item.textContent = `${mission.complete ? "✓" : "○"} ${mission.label}`;
    return item;
  });
}

function renderRecentActivity(sources: RecentSource[]): void {
  pulseRecentActivity.replaceChildren();
  if (sources.length === 0) {
    pulseRecentActivity.textContent = "No verified protocol activity was detected in the last 30 days. This section tracks on-chain activity, not every app launch.";
    return;
  }
  for (const source of sources.slice(0, 4)) {
    const item = document.createElement("div");
    item.className = "pulse-recent-item";
    const name = document.createElement("strong");
    name.textContent = source.source;
    const count = document.createElement("span");
    count.textContent = `${source.count} interaction${source.count === 1 ? "" : "s"}`;
    const lastUsed = document.createElement("small");
    lastUsed.textContent = `Last active ${formatLastSeen(source.lastUsedAt)}`;
    item.append(name, count, lastUsed);
    pulseRecentActivity.append(item);
  }
}

function renderDetectedDapps(records: DetectedDapp[]): void {
  detectedDapps.replaceChildren();
  renderDetectedCategories(records);
  const list = document.createElement("div");
  list.className = "detected-dapp-list";
  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "detected-dapp-empty";
    empty.textContent = "No verified catalog matches were detected in this wallet's recent public activity.";
    list.append(empty);
  } else {
    for (const record of records) {
      const item = document.createElement("article");
      item.className = "detected-dapp-item";
      if (record.dapp.iconUrl) {
        const icon = document.createElement("img");
        icon.src = record.dapp.iconUrl;
        icon.alt = `${record.dapp.name} logo`;
        icon.loading = "lazy";
        icon.addEventListener("error", () => icon.remove());
        item.append(icon);
      }
      const copy = document.createElement("div");
      copy.className = "detected-dapp-copy";
      const title = document.createElement("strong");
      title.textContent = record.dapp.name;
      const metadata = document.createElement("span");
      metadata.textContent = `${record.interactions} interaction${record.interactions === 1 ? "" : "s"} · last seen ${formatLastSeen(record.lastUsedAt)}`;
      copy.append(title, metadata);
      item.append(copy);
      if (record.dapp.deepLink) {
        const link = document.createElement("a");
        link.className = "detected-dapp-link";
        link.href = record.dapp.deepLink;
        link.textContent = "Open";
        item.append(link);
      }
      list.append(item);
    }
  }
  const note = document.createElement("p");
  note.className = "detected-dapp-note";
  note.textContent = "Detected from public transactions matched to verified Pulse catalog records. This is not a complete wallet history.";
  detectedDapps.append(list, note);
}

function renderDetectedCategories(records: DetectedDapp[]): void {
  detectedCategories.replaceChildren();
  const totals = new Map<string, { name: string; dapps: number; interactions: number }>();
  for (const record of records) {
    for (const category of record.dapp.categories) {
      const current = totals.get(category.slug) || { name: category.name, dapps: 0, interactions: 0 };
      current.dapps += 1;
      current.interactions += record.interactions;
      totals.set(category.slug, current);
    }
  }
  const categories = [...totals.values()].sort((a, b) => b.interactions - a.interactions).slice(0, 4);
  if (categories.length === 0) return;
  const maxInteractions = categories[0].interactions;
  const heading = document.createElement("p");
  heading.className = "detected-category-heading";
  heading.textContent = "Activity categories";
  detectedCategories.append(heading);
  for (const category of categories) {
    const row = document.createElement("div");
    row.className = "detected-category-row";
    const label = document.createElement("strong");
    label.textContent = category.name;
    const meta = document.createElement("span");
    meta.textContent = `${category.dapps} dApp${category.dapps === 1 ? "" : "s"} · ${category.interactions} interaction${category.interactions === 1 ? "" : "s"}`;
    const track = document.createElement("div");
    track.className = "detected-category-track";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(12, Math.round((category.interactions / maxInteractions) * 100))}%`;
    track.append(fill);
    row.append(label, meta, track);
    detectedCategories.append(row);
  }
}

function formatLastSeen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function renderMissions(data: LookupData): void {
  const categories = new Map(data.scorecard.categories.map((category) => [category.id, category]));
  const missions = [
    { label: "Connect your wallet", complete: Boolean(connectedAddress) },
    { label: "Explore 2 protocols", complete: (categories.get("dapps")?.value ?? 0) >= 2 },
    { label: "Keep a natural-use streak", complete: (categories.get("streak")?.value ?? 0) >= 1 },
  ];
  missionList.replaceChildren(...missions.map((mission) => {
    const item = document.createElement("li");
    item.className = mission.complete ? "mission-complete" : "";
    item.textContent = `${mission.complete ? "✓" : "○"} ${mission.label}`;
    return item;
  }));
}
function renderBanner(data: LookupData): void { identityBanner.innerHTML = ""; const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = data.isSeekerWallet ? "SEEKER ID" : "UNKNOWN"; identityBanner.className = `identity-banner ${data.isSeekerWallet ? "confirmed" : "unknown"}`; identityBanner.append(badge, textNode(data.isSeekerWallet ? (data.skrDomain ? `Confirmed Seeker wallet — ${data.skrDomain}` : "Confirmed Seeker wallet.") : "No .skr Seeker ID detected for this wallet — showing raw on-chain activity only. Official Seeker eligibility can't be confirmed here.")); const verdict = data.scorecard.overallVerdict; verdictBanner.className = `verdict-banner ${verdict}`; const title = document.createElement("strong"); title.textContent = verdict === "aligned" ? "✅ Looks aligned with natural use" : verdict === "watch" ? "⚠️ Some patterns worth a look" : verdict === "idle" ? "⏸️ Not enough recent activity" : "🔴 This looks like manufactured activity"; const explanation = document.createElement("span"); explanation.className = "verdict-explanation"; explanation.textContent = verdict === "aligned" ? "Your recent activity is varied and spread out. We found no strong repetition, burst, or dust-transfer pattern." : verdict === "watch" ? "One or more signals appeared recently. That is ambiguous, not a judgment, but varied activity is worth prioritizing." : verdict === "idle" ? "There are no recent transactions or dApp interactions to assess. Idle is neutral: it is not a risk signal." : "Repeated actions combined with burst timing or negligible transfers resemble activity made to grind a score."; verdictBanner.replaceChildren(title, explanation); }
function textNode(value: string): HTMLSpanElement { const span = document.createElement("span"); span.textContent = value; return span; }
function renderCategories(categories: Category[]): void { ringsGrid.innerHTML = ""; for (const category of categories) { const card = document.createElement("article"); card.className = `category-card ${category.verdict}`; const heading = document.createElement("div"); heading.className = "category-heading"; const label = document.createElement("h2"); label.textContent = category.label; const badge = document.createElement("span"); badge.className = "verdict-badge"; badge.textContent = verdictLabel(category.verdict); heading.append(label, badge); const raw = document.createElement("div"); raw.className = "category-raw"; raw.textContent = `${category.value} ${category.unit}`; const detail = document.createElement("p"); detail.className = "category-detail"; detail.textContent = category.detail; card.append(heading, raw, detail); ringsGrid.appendChild(card); } }
function verdictLabel(verdict: Verdict): string { return verdict === "aligned" ? "Aligned" : verdict === "watch" ? "Watch" : verdict === "idle" ? "Idle" : "At risk"; }
function renderSuggestions(suggestions: Suggestion[]): void { suggestionsList.innerHTML = ""; for (const suggestion of suggestions) { const item = document.createElement("li"); item.textContent = suggestion.text; suggestionsList.appendChild(item); } }
function shortenAddress(address: string): string { return !address || address.length < 10 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`; }
function startCountdown(nextResetIso: string): void { if (countdownTimer) clearInterval(countdownTimer); const target = new Date(nextResetIso).getTime(); const tick = () => { const diff = target - Date.now(); if (diff <= 0) { metaCountdown.textContent = "resetting…"; if (countdownTimer) clearInterval(countdownTimer); return; } const hours = String(Math.floor(diff / 3_600_000)).padStart(2, "0"); const minutes = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"); const seconds = String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0"); metaCountdown.textContent = `${hours}:${minutes}:${seconds} UTC`; }; tick(); countdownTimer = setInterval(tick, 1000); }
function renderDappRecommendations(data: DappFinderResponse): void {
  dappChatStatus.hidden = false;
  dappChatStatus.textContent = data.answer;
  dappChatResults.innerHTML = "";
  if (data.recommendations.length === 0) {
    dappChatResults.textContent = "No verified dApps are available yet.";
  } else {
    appendDappRecords(data.recommendations.map((recommendation) => ({ ...recommendation.dapp, recommendationReason: recommendation.reason })));
  }
  dappChatResults.hidden = false;
  dappLoadMore.hidden = data.recommendations.length === 0;
}

function appendDappRecords(dapps: Array<DappRecommendation["dapp"] & { recommendationReason?: string }>): void {
  for (const dapp of dapps) {
    const card = document.createElement("article");
    card.className = "dapp-chat-card";
    if (dapp.iconUrl) {
      const icon = document.createElement("img");
      icon.className = "dapp-chat-icon";
      icon.src = dapp.iconUrl;
      icon.alt = `${dapp.name} logo`;
      icon.loading = "lazy";
      icon.addEventListener("error", () => icon.remove());
      card.append(icon);
    }
    const title = document.createElement("h3");
    title.textContent = dapp.name;
    const description = document.createElement("p");
    description.textContent = dapp.shortDescription || dapp.description || "No description available.";
    card.append(title, description);
    const metadata = document.createElement("div");
    metadata.className = "dapp-chat-metadata";
    if (typeof dapp.rating === "number") metadata.append(metadataItem("Rating", `${dapp.rating.toFixed(1)}/5${typeof dapp.reviewCount === "number" ? ` (${dapp.reviewCount} reviews)` : ""}`));
    if (typeof dapp.pulseScore === "number") metadata.append(metadataItem("Pulse", `${dapp.pulseScore}/100`));
    if (metadata.childElementCount > 0) card.append(metadata);
    if (dapp.recommendationReason) {
      const reason = document.createElement("p");
      reason.className = "dapp-chat-reason";
      reason.textContent = dapp.recommendationReason;
      card.append(reason);
    }
    if (dapp.deepLink) {
      const link = document.createElement("a");
      link.className = "dapp-open-link";
      link.href = dapp.deepLink;
      link.textContent = "Open in Seeker";
      link.addEventListener("click", () => {
        void recordDappExploration(dapp.id);
      });
      card.append(link);
    }
    dappChatResults.append(card);
  }
}

function metadataItem(label: string, value: string): HTMLSpanElement {
  const item = document.createElement("span");
  item.className = `dapp-metadata-item dapp-metadata-${label.toLowerCase()}`;
  item.textContent = `${label} ${value}`;
  return item;
}

function renderJourneySummary(journey: { weeklyExplorationCount: number; mostExplored: Array<{ dappId: string; name: string; count: number; category: string; lastOpenedAt: string }>; recentlyExplored: Array<{ dappId: string; name: string; label: string; category: string; lastOpenedAt: string }>; categories: Array<{ name: string; count: number; totalOpens: number }>; newDiscoveries: number; nextMove: string }): void {
  pulseJourney.replaceChildren();

  const summary = document.createElement("div");
  summary.className = "pulse-journey-summary";

  const primary = document.createElement("div");
  primary.className = "journey-primary";
  primary.textContent = `${journey.weeklyExplorationCount} opens this week across ${journey.categories.length || 1} active lanes.`;

  const meta = document.createElement("div");
  meta.className = "journey-meta";
  meta.textContent = `${journey.newDiscoveries} new discoveries · ${journey.recentlyExplored[0]?.name || "Fresh start"} most recent`;

  const pills = document.createElement("div");
  pills.className = "pulse-journey-row";
  for (const item of journey.mostExplored.slice(0, 3)) {
    const pill = document.createElement("span");
    pill.className = "pulse-journey-pill";
    pill.textContent = `${item.name} · ${item.count}`;
    pills.append(pill);
  }

  const nextMove = document.createElement("div");
  nextMove.className = "journey-meta";
  nextMove.textContent = journey.nextMove;

  summary.append(primary, meta);
  pulseJourney.append(summary, pills, nextMove);
}