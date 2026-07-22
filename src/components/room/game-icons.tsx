import type { PlayerCrest, Resource } from "@/game";

export const RESOURCE_LABELS: Record<Resource, string> = {
  brick: "Clay",
  lumber: "Timber",
  wool: "Fleece",
  grain: "Grain",
  ore: "Stone",
};

export function ResourceIcon({ resource, className }: { resource: Resource; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      {resource === "brick" && <><path d="M7 13h34v23H7z"/><path d="M7 24h34M18 13v11m17 0v12M12 24v12m18-23v11"/></>}
      {resource === "lumber" && <><path d="M24 5 12 20h7L9 34h30L29 20h7Z"/><path d="M24 31v12"/></>}
      {resource === "wool" && <><path d="M14 33a8 8 0 0 1-1-16 10 10 0 0 1 19-3 8 8 0 1 1 3 19Z"/><path d="M16 33v7m16-7v7"/></>}
      {resource === "grain" && <><path d="M24 43V8"/><path d="M23 15c-7 0-9-4-9-8 7 0 9 4 9 8Zm2 7c7 0 9-4 9-8-7 0-9 4-9 8Zm-2 8c-7 0-9-4-9-8 7 0 9 4 9 8Zm2 7c7 0 9-4 9-8-7 0-9 4-9 8Z"/></>}
      {resource === "ore" && <><path d="m8 33 8-19 11-7 13 11-4 20-18 4Z"/><path d="m16 14 8 12 16-8M24 26l-6 16m6-16 12 12"/></>}
    </svg>
  );
}

export function CrestIcon({ crest, className }: { crest: PlayerCrest; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      {crest === "sun" && <><circle cx="20" cy="20" r="6"/><path d="M20 3v7m0 20v7M3 20h7m20 0h7M8 8l5 5m14 14 5 5m0-24-5 5M13 27l-5 5"/></>}
      {crest === "wave" && <><path d="M4 15c5 0 5-5 10-5s5 5 10 5 5-5 12-5M4 24c5 0 5-5 10-5s5 5 10 5 5-5 12-5M8 32c5 0 5-4 10-4s5 4 10 4"/></>}
      {crest === "leaf" && <><path d="M34 7C19 7 8 15 8 27c0 5 4 8 8 8 12 0 18-13 18-28Z"/><path d="M9 34c7-9 13-14 23-24M17 26l-1-9m8 2 7 1"/></>}
      {crest === "moon" && <><path d="M29 31A15 15 0 1 1 28 8c-8 1-12 7-12 13 0 7 5 11 13 10Z"/><path d="m30 9 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></>}
    </svg>
  );
}

export function IdeaIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 30 18l14 6-14 6-6 14-6-14-14-6 14-6Z"/><circle cx="24" cy="24" r="5"/></svg>;
}
