import type { Pathway } from "@workspace/api-client-react";

export type PathwayListField = "skills" | "milestones" | "projects" | "readinessCriteria";

/** A Pathway whose list fields are guaranteed arrays, so views can index them directly. */
export type NormalizedPathway = Omit<Pathway, PathwayListField> & Record<PathwayListField, string[]>;

/**
 * The API stores blank imported list columns as null and the contract marks the
 * four list fields nullable, so coerce them once here — at the data boundary —
 * rather than guarding every render site.
 */
export function normalizePathway(p: Pathway): NormalizedPathway {
  return {
    ...p,
    skills: p.skills ?? [],
    milestones: p.milestones ?? [],
    projects: p.projects ?? [],
    readinessCriteria: p.readinessCriteria ?? [],
  };
}

/** `select` transform for `useGetPathways`. */
export function normalizePathways(pathways: Pathway[]): NormalizedPathway[] {
  return pathways.map(normalizePathway);
}
