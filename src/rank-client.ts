import type { RankFetcher } from './recorder';

/** apexlegendsstatus.com player lookup. Unofficial API: https://apexlegendsapi.com/ */
export class ApexStatusClient implements RankFetcher {
  constructor(
    private readonly apiKey: string,
    private readonly platform = 'PC',
  ) {}

  async fetchPlayer(playerName: string): Promise<{ status: number; body: unknown }> {
    const url = new URL('https://api.apexlegendsstatus.com/bridge');
    url.searchParams.set('player', playerName);
    url.searchParams.set('platform', this.platform);

    const res = await fetch(url, {
      headers: { Authorization: this.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep the raw text; the views will flag it.
    }
    return { status: res.status, body };
  }
}
