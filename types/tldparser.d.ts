declare module "@onsol/tldparser" {
  import type { Connection, PublicKey } from "@solana/web3.js";

  export class TldParser {
    constructor(connection: Connection);
    getOwnerFromDomainTld(domain: string): Promise<PublicKey | null>;
    getAllUserDomainsFromTld(owner: PublicKey, tld: string): Promise<unknown[]>;
    getParsedAllUserDomainsFromTld(owner: PublicKey, tld: string): Promise<Array<{ domain?: string }>>;
  }
}