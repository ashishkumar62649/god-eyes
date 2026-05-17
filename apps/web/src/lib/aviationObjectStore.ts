import type { AirportObject } from '@god-eyes/contracts';

const store = new Map<string, AirportObject>();

export function storeObject(airport: AirportObject): void {
  store.set(airport.id, airport);
}

export function storeObjects(airports: AirportObject[]): void {
  for (const ap of airports) {
    store.set(ap.id, ap);
  }
}

export function getObject(id: string): AirportObject | undefined {
  return store.get(id);
}

export function getAllObjects(): AirportObject[] {
  return Array.from(store.values());
}

export function clearObjectStore(): void {
  store.clear();
}

export function getObjectCount(): number {
  return store.size;
}

export function hasObject(id: string): boolean {
  return store.has(id);
}
