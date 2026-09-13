type LegalKey = "privacy" | "terms" | "copyright" | "legal";

type LegalSection = { title: string; body: string };

const content: Record<LegalKey, { label: string; title: string; sections: LegalSection[] }> = {
  privacy: { label: "Privacy", title: "Privacy Policy", sections: [
    { title: "What Seeker Pulse does", body: "Seeker Pulse is an independent tool that reads public blockchain and dApp catalog information to provide activity estimates and dApp discovery. It is not an official Solana Mobile service." },
    { title: "Information processed", body: "When you submit a .skr domain or wallet-related lookup, the service processes the information needed to resolve the identity and retrieve public activity data. dApp searches process your search message and catalog query." },
    { title: "What we do not request", body: "Seeker Pulse does not ask for private keys, seed phrases, wallet signatures, transaction approvals, or payment credentials. The dApp finder does not execute transactions." },
    { title: "Third-party services", body: "The service may use Helius for blockchain data, PostgreSQL/Prisma for catalog storage, Vercel for hosting and performance measurement, and an optional server-side AI provider for recommendation explanations. Their own policies may apply." },
    { title: "Contact", body: "For privacy questions, contact the project creator through the public project profile at x.com/oslaammanny." },
  ] },
  terms: { label: "Terms", title: "Terms of Use", sections: [
    { title: "Acceptance", body: "By using Seeker Pulse, you agree to these Terms of Use. If you do not agree, do not use the service." },
    { title: "Informational service", body: "Seeker Pulse provides estimates, discovery tools, and explanations based on available public data. Results may be incomplete, delayed, or inaccurate. They are not financial, legal, tax, investment, security, or trading advice." },
    { title: "No transaction execution", body: "Seeker Pulse does not custody funds, connect to wallets for signing, execute transactions, stake tokens, perform swaps, or make decisions on your behalf." },
    { title: "Acceptable use", body: "Do not abuse the service, bypass access controls, submit secrets, interfere with the API, or use results to harm others." },
    { title: "Availability", body: "The service is provided on an as-available basis. Features, data sources, and these terms may change as the project develops." },
  ] },
  copyright: { label: "Copyright", title: "Copyright and Content", sections: [
    { title: "Seeker Pulse content", body: "Unless otherwise stated, the Seeker Pulse name, original interface, source code, written copy, styling, and original graphics are owned by the project creator or used with permission." },
    { title: "Third-party content", body: "App names, logos, descriptions, ratings, package names, and other dApp metadata may belong to their respective developers, publishers, or data sources. Seeker Pulse does not claim ownership of those materials." },
    { title: "Open-source software", body: "This project uses open-source libraries and frameworks under their applicable licenses. Those licenses remain with their respective copyright holders." },
    { title: "Copyright concerns", body: "If you believe content displayed by Seeker Pulse infringes your rights, contact the project creator through the public project profile at x.com/oslaammanny." },
  ] },
  legal: { label: "Legal", title: "Legal Information", sections: [
    { title: "Independent project", body: "Seeker Pulse is an independent, unofficial project. It is not operated by, sponsored by, endorsed by, or affiliated with Solana Mobile, Solana, the Solana dApp Store, or any wallet provider." },
    { title: "Activity estimates", body: "Displayed activity and scorecard information is calculated from public data and project-defined heuristics. It is not an official Seed Vault Wallet score." },
    { title: "dApp catalog", body: "The catalog is maintained by Seeker Pulse and may include imported public metadata. A catalog record does not guarantee that an app is safe, available, compatible, reviewed, endorsed, or suitable for a particular purpose." },
    { title: "Trademarks", body: "Third-party names, logos, marks, and app descriptions belong to their respective owners. Their appearance in the catalog does not imply endorsement." },
  ] },
};

function h(tag: string, props: Record<string, string> = {}, children: Array<HTMLElement | Text> = []): HTMLElement {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => element.setAttribute(key, value));
  element.append(...children);
  return element;
}

function text(value: string): Text { return document.createTextNode(value); }

function renderLegal(key: LegalKey): void {
  const data = content[key];
  const root = document.getElementById("legal-panel-content");
  const panel = document.getElementById("legal-panel");
  if (!root || !panel) return;
  const documentEl = h("article", { class: "legal-document" });
  documentEl.append(h("div", { class: "section-kicker" }, [text(data.label)]));
  documentEl.append(h("h2", { id: "legal-panel-title" }, [text(data.title)]));
  documentEl.append(h("p", { class: "legal-updated" }, [text("Last updated: September 9, 2026")]));
  data.sections.forEach((section) => documentEl.append(h("section", {}, [h("h3", {}, [text(section.title)]), h("p", {}, [text(section.body)])])));
  root.replaceChildren(documentEl);
  panel.hidden = false;
}

const panel = document.getElementById("legal-panel");
const legalPage = document.getElementById("legal-page-content");
const legalPath = window.location.pathname.replace(/^\//, "") as LegalKey;
if (legalPage && content[legalPath]) {
  const documentEl = h("article", { class: "legal-document" });
  const data = content[legalPath];
  documentEl.append(h("div", { class: "section-kicker" }, [text(data.label)]));
  documentEl.append(h("h1", {}, [text(data.title)]));
  documentEl.append(h("p", { class: "legal-updated" }, [text("Last updated: September 9, 2026")]));
  data.sections.forEach((section) => documentEl.append(h("section", {}, [h("h2", {}, [text(section.title)]), h("p", {}, [text(section.body)])])));
  legalPage.replaceChildren(documentEl);
}
document.querySelectorAll<HTMLButtonElement>("[data-legal]").forEach((button) => button.addEventListener("click", () => {
  renderLegal(button.dataset.legal as LegalKey);
  document.getElementById("site-sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.setAttribute("hidden", "true");
}));
document.getElementById("legal-panel-close")?.addEventListener("click", () => { if (panel) panel.hidden = true; });
panel?.addEventListener("click", (event) => { if (event.target === panel) panel.hidden = true; });
