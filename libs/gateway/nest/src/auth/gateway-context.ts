export const COMMERCE_SESSION_REQUEST_HEADERS = [
  'cookie',
  'woocommerce-session',
  'cart-token',
] as const;

export const COMMERCE_SESSION_RESPONSE_HEADERS = [
  'woocommerce-session',
  'cart-token',
] as const;

const WOOCOMMERCE_COOKIE_NAMES = [
  'woocommerce_cart_hash',
  'woocommerce_items_in_cart',
] as const;
const WOOCOMMERCE_COOKIE_PREFIXES = ['wp_woocommerce_session_'] as const;

export type CommerceSessionRequestHeader =
  (typeof COMMERCE_SESSION_REQUEST_HEADERS)[number];

export type CommerceSessionHeaders = Readonly<
  Partial<Record<CommerceSessionRequestHeader, string>>
>;

export type AuthenticationPrincipal = {
  audience: readonly string[];
  scopes: readonly string[];
  subject: string;
  supplierCompanyId?: string;
};

export type GatewayContext = {
  authorization: string;
  principal: AuthenticationPrincipal;
  requestId: string;
  sessionHeaders: CommerceSessionHeaders;
  setResponseHeader?: (name: string, value: string | string[]) => void;
};

export function allowlistedCommerceCookies(
  header: string | null | undefined,
): string | undefined {
  const cookies = (header ?? '')
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => {
      const separator = cookie.indexOf('=');
      if (separator < 1) return false;
      const name = cookie.slice(0, separator);
      return (
        WOOCOMMERCE_COOKIE_NAMES.includes(
          name as (typeof WOOCOMMERCE_COOKIE_NAMES)[number],
        ) ||
        WOOCOMMERCE_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))
      );
    });
  return cookies.length > 0 ? cookies.join('; ') : undefined;
}
