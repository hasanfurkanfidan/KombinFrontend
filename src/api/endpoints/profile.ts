import { request } from '../client';
import type {
  CreatePersonaRequest,
  Persona,
  PersonaList,
  Profile,
  SizeEntry,
  SizeList,
  StyleCards,
  SubmitSwipesResponse,
  SwipeItem,
  UpdatePersonaRequest,
  UpdateProfileRequest,
  UpsertSizeRequest,
} from '../models';

export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return request<Profile>('/api/v1/me/profile', { auth: true, signal });
}

/** The backend replaces the measurements: a field left out is cleared, so callers send the full set. */
export function updateProfile(body: UpdateProfileRequest): Promise<Profile> {
  return request<Profile>('/api/v1/me/profile', { method: 'PUT', body, auth: true });
}

export function listPersonas(signal?: AbortSignal): Promise<PersonaList> {
  return request<PersonaList>('/api/v1/me/personas', { auth: true, signal });
}

/** The app only sets name and icon; every other preference stays at the backend's default. */
export function createPersona(input: { name: string; icon: string }): Promise<Persona> {
  const body: CreatePersonaRequest = {
    ...input,
    budgetMin: null,
    budgetMax: null,
    formalityMin: null,
    formalityMax: null,
    preferredColors: null,
    avoidedColors: null,
    preferredFits: null,
    seasons: null,
  };
  return request<Persona>('/api/v1/me/personas', { method: 'POST', body, auth: true });
}

export function updatePersona(id: string, patch: Partial<UpdatePersonaRequest>): Promise<Persona> {
  const body: UpdatePersonaRequest = {
    name: null,
    icon: null,
    sortOrder: null,
    budgetMin: null,
    budgetMax: null,
    clearBudget: null,
    formalityMin: null,
    formalityMax: null,
    preferredColors: null,
    avoidedColors: null,
    preferredFits: null,
    seasons: null,
    ...patch,
  };
  return request<Persona>(`/api/v1/me/personas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

/** Archives the persona (`DELETE`, 204); it disappears from the list. */
export function archivePersona(id: string): Promise<void> {
  return request<void>(`/api/v1/me/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function activatePersona(id: string): Promise<void> {
  return request<void>(`/api/v1/me/personas/${encodeURIComponent(id)}/activate`, {
    method: 'PUT',
    auth: true,
  });
}

export function getStyleCards(
  personaId: string,
  limit: number,
  signal?: AbortSignal,
): Promise<StyleCards> {
  return request<StyleCards>(`/api/v1/me/personas/${encodeURIComponent(personaId)}/style-cards`, {
    query: { limit },
    auth: true,
    signal,
  });
}

export function submitSwipes(
  personaId: string,
  swipes: readonly SwipeItem[],
): Promise<SubmitSwipesResponse> {
  return request<SubmitSwipesResponse>(
    `/api/v1/me/personas/${encodeURIComponent(personaId)}/swipes`,
    { method: 'POST', body: { swipes }, auth: true },
  );
}

export function listSizes(signal?: AbortSignal): Promise<SizeList> {
  return request<SizeList>('/api/v1/me/sizes', { auth: true, signal });
}

export function upsertSize(body: UpsertSizeRequest): Promise<SizeEntry> {
  return request<SizeEntry>('/api/v1/me/sizes', { method: 'PUT', body, auth: true });
}
