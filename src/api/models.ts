/**
 * Named aliases over the generated contract types. Nothing is declared by hand here:
 * every type is picked out of `types.gen.ts`, so a contract change surfaces as a compile error.
 */
import type { components, operations } from './types.gen';

type Schemas = components['schemas'];

export type AuthTokens = Schemas['AuthTokensResponse'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type Me = Schemas['MeResponse'];

export type CategoryNode = Schemas['CategoryNode'];
export type ProductListItem = Schemas['ProductListItem'];
export type ProductPage = Schemas['PagedResponseOfProductListItem'];
export type Product = Schemas['ProductResponse'];
export type Offer = Schemas['OfferResponse'];
export type PriceSummary = Schemas['PriceSummary'];
export type OfferSeries = Schemas['OfferSeries'];
export type PricePoint = Schemas['PricePoint'];

export type Brand = Schemas['BrandItem'];
export type BrandPage = Schemas['PagedResponseOfBrandItem'];

export type Audience = Schemas['Audience'];
export type ProductColor = Schemas['ProductColor'];
export type StockStatus = Schemas['StockStatus'];

/** Query-string parameters of `GET /catalog/products`, exactly as the contract names them. */
export type ListProductsQuery = NonNullable<operations['ListProducts']['parameters']['query']>;

/** RFC 9457 body plus the `errorCode` / `errors` extensions the backend adds (not part of the generated schema). */
export type ProblemBody = Schemas['ProblemDetails'] & {
  errorCode?: string;
  errors?: Record<string, string[]>;
};

export type SizeHint = Schemas['SizeHintResponse'];
export type SizeSource = Schemas['SizeSource'];
export type SizeGroup = Schemas['SizeGroup'];

export type Profile = Schemas['ProfileResponse'];
export type UpdateProfileRequest = Schemas['UpdateProfileRequest'];
export type Persona = Schemas['PersonaResponse'];
export type PersonaList = Schemas['PersonaListResponse'];
export type CreatePersonaRequest = Schemas['CreatePersonaRequest'];
export type UpdatePersonaRequest = Schemas['UpdatePersonaRequest'];
export type StyleSummary = Schemas['StyleSummary'];
export type StyleCard = Schemas['StyleCardItem'];
export type StyleCards = Schemas['StyleCardsResponse'];
export type StyleFamily = Schemas['StyleFamily'];
export type SwipeItem = Schemas['SwipeItem'];
export type SubmitSwipesResponse = Schemas['SubmitSwipesResponse'];
export type SizeEntry = Schemas['SizeEntryResponse'];
export type SizeList = Schemas['SizeListResponse'];
export type UpsertSizeRequest = Schemas['UpsertSizeRequest'];

export type SavedProduct = Schemas['SavedProductItem'];
export type SavedPage = Schemas['PagedResponseOfSavedProductItem'];
export type SavedIds = Schemas['SavedIdsResponse'];
export type Alert = Schemas['AlertResponse'];
export type AlertList = Schemas['ListAlertsResponse'];
export type AlertKind = Schemas['AlertKind'];
export type CreateAlertRequest = Schemas['CreateAlertRequest'];
export type UpdateAlertRequest = Schemas['UpdateAlertRequest'];
export type AlertTrigger = Schemas['TriggerResponse'];
export type TriggerPage = Schemas['PagedResponseOfTriggerResponse'];

export type Notification = Schemas['NotificationResponse'];
export type NotificationKind = Schemas['NotificationKind'];
export type NotificationPage = Schemas['PagedResponseOfNotificationResponse'];
export type NotificationPreferences = Schemas['PreferencesResponse'];
export type UpdateNotificationPreferencesRequest = Schemas['UpdatePreferencesRequest'];
export type RegisterDeviceRequest = Schemas['RegisterDeviceRequest'];
export type LogoutRequest = Schemas['LogoutRequest'];

/**
 * `properties` is a free-form JSON object that openapi-typescript renders as `Record<string, never>`; events carry
 * flat key/values (see the allow-list in `src/analytics/events.ts`), so it is widened here.
 */
export type EventItem = Omit<Schemas['EventItem'], 'properties'> & {
  properties: Record<string, string | number | boolean> | null;
};
export type RecordEventsRequest = { events: EventItem[] };
export type RecordEventsResponse = Schemas['RecordEventsResponse'];
