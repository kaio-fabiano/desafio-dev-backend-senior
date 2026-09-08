import { CommerceCookiePort } from '../../application/ports/commerce-cookie.port.ts';

export class CommerceCookieAdapter extends CommerceCookiePort {
  allowlisted(header: string | null | undefined): string | undefined {
    const cookies = (header ?? '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter((cookie) => {
        const separator = cookie.indexOf('=');
        if (separator < 1) return false;
        const name = cookie.slice(0, separator);
        return (
          name === 'woocommerce_cart_hash' ||
          name === 'woocommerce_items_in_cart' ||
          name.startsWith('wp_woocommerce_session_')
        );
      });
    return cookies.length > 0 ? cookies.join('; ') : undefined;
  }
}
