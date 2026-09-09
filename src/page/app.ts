type Verdict = "aligned" | "watch" | "at_risk" | "idle";
interface Category { id: string; label: string; verdict: Verdict; detail: string; value: number; unit: string; }
interface Suggestion { text: string; }
interface LookupData { address: string; skrDomain: string | null; isSeekerWallet: boolean; scorecard: { overallVerdict: Verdict; categories: Category[]; suggestions: Suggestion[] }; nextResetUtc: string; }
interface DomainSuggestionResponse { domains: Array<{ domain: string | null; address: string }>; }
interface DappRecommendation { dapp: { id: string; name: string; shortDescription: string | null; description: string | null; deepLink: string | null; iconUrl: string | null; rating: number | null; reviewCount: number | null; pulseScore: number | null }; reason: string; relevance: number; }
interface DappFinderResponse { answer: string; recommendations: DappRecommendation[]; }
interface DappListResponse { dapps: DappRecommendation["dapp"][]; count: number; }

const form = document.getElementById("lookup-form") as HTMLFormElement;
const input = document.getElementById("lookup-input") as HTMLInputElement;
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const formError = document.getElementById("form-error") as HTMLDivElement;
const loadingEl = document.getElementById("loading") as HTMLElement;
const resultEl = document.getElementById("result") as HTMLElement;
const identityBanner = document.getElementById("identity-banner") as HTMLElement;
const ringsGrid = document.getElementById("rings-grid") as HTMLElement;
const verdictBanner = document.getElementById("verdict-banner") as HTMLElement;
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
const lookupMode = document.getElementById("lookup-mode") as HTMLButtonElement;
const catalogMode = document.getElementById("catalog-mode") as HTMLButtonElement;
let currentCatalogQuery = "";
let currentCatalogOffset = 0;
let catalogLoading = false;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let suggestionRequest: ReturnType<typeof setTimeout> | null = null;
let suggestionRequestId = 0;

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

lookupMode.addEventListener("click", () => setMode("lookup"));
catalogMode.addEventListener("click", () => setMode("catalog"));
dappLoadMore.addEventListener("click", loadMoreDapps);
dappPrompts.forEach((prompt) => prompt.addEventListener("click", () => {
  dappChatInput.value = prompt.dataset.prompt || "";
  dappChatInput.focus();
}));

function setMode(mode: "lookup" | "catalog"): void {
  const catalogActive = mode === "catalog";
  lookupMode.classList.toggle("active", !catalogActive);
  catalogMode.classList.toggle("active", catalogActive);
  lookupMode.setAttribute("aria-selected", String(!catalogActive));
  catalogMode.setAttribute("aria-selected", String(catalogActive));
  form.hidden = catalogActive;
  dappChat.hidden = !catalogActive;
  if (catalogActive) dappChatInput.focus();
}

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
    const response = await fetch("/api/ai/dapp-finder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const data = await response.json() as DappFinderResponse & { error?: string };
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
    const response = await fetch(`/api/dapps?${params}`);
    const data = await response.json() as DappListResponse & { error?: string };
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
    const response = await fetch(`/api/lookup?q=${encodeURIComponent(lookupQuery)}`);
    const data = await response.json() as LookupData & { error?: string };
    if (!response.ok) throw new Error(data.error || "Lookup failed.");
    hideDomainSuggestions();
    render(data);
  } catch (error) { formError.textContent = error instanceof Error ? error.message : "Lookup failed."; formError.hidden = false; }
  finally { setLoading(false); }
});

function normalizeLookupQuery(query: string): string {
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
    const response = await fetch(`/api/domain-suggestions?name=${encodeURIComponent(normalized)}`);
    const data = await response.json() as DomainSuggestionResponse;
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
function render(data: LookupData): void { renderBanner(data); renderCategories(data.scorecard.categories); renderSuggestions(data.scorecard.suggestions); metaAddress.textContent = data.skrDomain || shortenAddress(data.address); startCountdown(data.nextResetUtc); resultEl.hidden = false; resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
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