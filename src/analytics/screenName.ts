const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * `screen_view`'s `screen` value for a route path: ids are replaced so one screen is one value
 * (`/product/6f1c…` -> `product/:id`), the root is `home`.
 */
export function screenName(pathname: string): string {
  const name = pathname.replace(UUID, ':id').replace(/^\/+|\/+$/g, '');
  return name === '' ? 'home' : name.slice(0, 60);
}
