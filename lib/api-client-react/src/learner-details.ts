import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// Types matching the DB schema
export interface LearnerRoadmap {
  id: number;
  learnerId: number;
  title: string;
  state: string;
  dueDate: string;
}

export interface LearnerEvent {
  id: number;
  learnerId: number;
  title: string;
  date: string;
  status: string;
}

export interface LearnerNote {
  id: number;
  learnerId: number;
  author: string;
  date: string;
  content: string;
}

export interface LearnerReadinessScore {
  id: number;
  learnerId: number;
  dimension: string;
  score: number;
}

export interface LearnerActivity {
  id: number;
  learnerId: number;
  type: string;
  event: string;
  date: string;
}

export function useGetLearnerRoadmaps(id: number, options?: { query?: UseQueryOptions<LearnerRoadmap[], ErrorType> }) {
  return useQuery<LearnerRoadmap[], ErrorType>({
    queryKey: [`/api/learners/${id}/roadmaps`],
    queryFn: ({ signal }) => customFetch(`/api/learners/${id}/roadmaps`, { method: "GET", signal }),
    enabled: !!id,
    ...options?.query,
  });
}

export function useGetLearnerEvents(id: number, options?: { query?: UseQueryOptions<LearnerEvent[], ErrorType> }) {
  return useQuery<LearnerEvent[], ErrorType>({
    queryKey: [`/api/learners/${id}/events`],
    queryFn: ({ signal }) => customFetch(`/api/learners/${id}/events`, { method: "GET", signal }),
    enabled: !!id,
    ...options?.query,
  });
}

export function useGetLearnerNotes(id: number, options?: { query?: UseQueryOptions<LearnerNote[], ErrorType> }) {
  return useQuery<LearnerNote[], ErrorType>({
    queryKey: [`/api/learners/${id}/notes`],
    queryFn: ({ signal }) => customFetch(`/api/learners/${id}/notes`, { method: "GET", signal }),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateLearnerNote(id: number, options?: { mutation?: UseMutationOptions<LearnerNote, ErrorType, { author: string; date: string; content: string }> }) {
  const queryClient = useQueryClient();
  return useMutation<LearnerNote, ErrorType, { author: string; date: string; content: string }>({
    mutationFn: (data) => customFetch(`/api/learners/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/learners/${id}/notes`] }); },
    ...options?.mutation,
  });
}

export function useUpdateLearnerNote(learnerId: number) {
  const queryClient = useQueryClient();
  return useMutation<LearnerNote, ErrorType, { noteId: number; content: string }>({
    mutationFn: ({ noteId, content }) => customFetch(`/api/learners/${learnerId}/notes/${noteId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/learners/${learnerId}/notes`] }); },
  });
}

export function useDeleteLearnerNote(learnerId: number) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ErrorType, number>({
    mutationFn: (noteId) => customFetch(`/api/learners/${learnerId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/learners/${learnerId}/notes`] }); },
  });
}

export function useGetLearnerReadiness(id: number, options?: { query?: UseQueryOptions<LearnerReadinessScore[], ErrorType> }) {
  return useQuery<LearnerReadinessScore[], ErrorType>({
    queryKey: [`/api/learners/${id}/readiness`],
    queryFn: ({ signal }) => customFetch(`/api/learners/${id}/readiness`, { method: "GET", signal }),
    enabled: !!id,
    ...options?.query,
  });
}

export function useGetLearnerActivities(id: number, options?: { query?: UseQueryOptions<LearnerActivity[], ErrorType> }) {
  return useQuery<LearnerActivity[], ErrorType>({
    queryKey: [`/api/learners/${id}/activities`],
    queryFn: ({ signal }) => customFetch(`/api/learners/${id}/activities`, { method: "GET", signal }),
    enabled: !!id,
    ...options?.query,
  });
}
