import { Connection, PublicKey } from "@solana/web3.js";
import { TldParser } from "@onsol/tldparser";

const SKR_SUFFIX = ".skr";

class IdentityError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface Identity {
  address: string;
  skrDomain: string | null;
  isSeekerWallet: boolean;
}

export async function resolveIdentity(rawInput: string, rpcUrl: string): Promise<Identity> {
  const input = rawInput.trim();
  const parser = new TldParser(new Connection(rpcUrl, "confirmed"));
  let address: string;
  let skrDomain: string | null = null;

  if (input.toLowerCase().endsWith(SKR_SUFFIX)) {
    const domain = input.toLowerCase();
    try {
      const owner = await parser.getOwnerFromDomainTld(domain);
      if (!owner) throw new Error();
      address = owner.toString();
      skrDomain = domain;
    } catch {
      throw new IdentityError("DOMAIN_NOT_FOUND", `Couldn't find a wallet for "${domain}". Double check the domain is registered.`);
    }
  } else {
    try {
      address = new PublicKey(input).toString();
    } catch {
      throw new IdentityError("INVALID_INPUT", "That doesn't look like a valid wallet address or .skr domain.");
    }
  }

  if (!skrDomain) skrDomain = await findSkrDomainForOwner(parser, address);
  return { address, skrDomain, isSeekerWallet: Boolean(skrDomain) };
}

async function findSkrDomainForOwner(parser: TldParser, address: string): Promise<string | null> {
  const owner = new PublicKey(address);
  for (const tld of ["skr", ".skr"]) {
    try {
      const domains = await parser.getAllUserDomainsFromTld(owner, tld);
      if (domains && domains.length > 0) {
        const parsed = await parser.getParsedAllUserDomainsFromTld(owner, tld).catch(() => null);
        return parsed?.[0]?.domain ? `${parsed[0].domain}${SKR_SUFFIX}` : SKR_SUFFIX;
      }
    } catch {
      // Try the alternate TLD format.
    }
  }
  return null;
}