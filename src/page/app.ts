interface Ring { id: string; label: string; value: number; target: number; unit: string; percent: number; }
interface Suggestion { text: string; }
interface LookupData { address: string; skrDomain: string | null; isSeekerWallet: boolean; scorecard: { rings: Ring[]; suggestions: Suggestion[] }; nextResetUtc: string; }
interface DomainSuggestionResponse { domains: Array<{ domain: string | null; address: string }>; }

const form = document.getElementById("lookup-form") as HTMLFormElement;
const input = document.getElementById("lookup-input") as HTMLInputElement;
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const formError = document.getElementById("form-error") as HTMLDivElement;
const loadingEl = document.getElementById("loading") as HTMLElement;
const resultEl = document.getElementById("result") as HTMLElement;
const identityBanner = document.getElementById("identity-banner") as HTMLElement;
const ringsGrid = document.getElementById("rings-grid") as HTMLElement;
const suggestionsList = document.getElementById("suggestions-list") as HTMLUListElement;
const metaAddress = document.getElementById("meta-address") as HTMLElement;
const metaCountdown = document.getElementById("meta-countdown") as HTMLElement;
const domainSuggestions = document.getElementById("domain-suggestions") as HTMLDivElement;
const RING_COLORS: Record<string, string> = { onchain: "var(--ring-onchain)", dapps: "var(--ring-dapps)", streak: "var(--ring-streak)" };
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let suggestionRequest: ReturnType<typeof setTimeout> | null = null;
let suggestionRequestId = 0;

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
  setLoading(true); formError.hidden = true; resultEl.hidden = true;
  try {
    const response = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
    const data = await response.json() as LookupData & { error?: string };
    if (!response.ok) throw new Error(data.error || "Lookup failed.");
    hideDomainSuggestions();
    render(data);
  } catch (error) { formError.textContent = error instanceof Error ? error.message : "Lookup failed."; formError.hidden = false; }
  finally { setLoading(false); }
});

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
function render(data: LookupData): void { renderBanner(data); renderRings(data.scorecard.rings); renderSuggestions(data.scorecard.suggestions); metaAddress.textContent = data.skrDomain || shortenAddress(data.address); startCountdown(data.nextResetUtc); resultEl.hidden = false; resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
function renderBanner(data: LookupData): void { identityBanner.innerHTML = ""; const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = data.isSeekerWallet ? "SEEKER ID" : "UNKNOWN"; identityBanner.className = `identity-banner ${data.isSeekerWallet ? "confirmed" : "unknown"}`; identityBanner.append(badge, textNode(data.isSeekerWallet ? (data.skrDomain ? `Confirmed Seeker wallet — ${data.skrDomain}` : "Confirmed Seeker wallet.") : "No .skr Seeker ID detected for this wallet — showing raw on-chain activity only. Official Seeker eligibility can't be confirmed here.")); }
function textNode(value: string): HTMLSpanElement { const span = document.createElement("span"); span.textContent = value; return span; }
function renderRings(rings: Ring[]): void { ringsGrid.innerHTML = ""; const radius = 56; const circumference = 2 * Math.PI * radius; for (const ring of rings) { const card = document.createElement("div"); card.className = "ring-card"; const offset = circumference * (1 - ring.percent / 100); const color = RING_COLORS[ring.id] || "var(--grad-b)"; card.innerHTML = `<div class="ring-svg-wrap"><svg viewBox="0 0 132 132"><circle class="ring-track" cx="66" cy="66" r="${radius}" /><circle class="ring-progress" cx="66" cy="66" r="${radius}" stroke="${color}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" /></svg><div class="ring-percent">${ring.percent}%</div></div><div class="ring-label">${ring.label}</div><div class="ring-detail">${ring.value} / ${ring.target} ${ring.unit}</div>`; ringsGrid.appendChild(card); requestAnimationFrame(() => { const progressEl = card.querySelector(".ring-progress"); requestAnimationFrame(() => progressEl?.setAttribute("stroke-dashoffset", String(offset))); }); } }
function renderSuggestions(suggestions: Suggestion[]): void { suggestionsList.innerHTML = ""; for (const suggestion of suggestions) { const item = document.createElement("li"); item.textContent = suggestion.text; suggestionsList.appendChild(item); } }
function shortenAddress(address: string): string { return !address || address.length < 10 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`; }
function startCountdown(nextResetIso: string): void { if (countdownTimer) clearInterval(countdownTimer); const target = new Date(nextResetIso).getTime(); const tick = () => { const diff = target - Date.now(); if (diff <= 0) { metaCountdown.textContent = "resetting…"; if (countdownTimer) clearInterval(countdownTimer); return; } const hours = String(Math.floor(diff / 3_600_000)).padStart(2, "0"); const minutes = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"); const seconds = String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0"); metaCountdown.textContent = `${hours}:${minutes}:${seconds} UTC`; }; tick(); countdownTimer = setInterval(tick, 1000); }