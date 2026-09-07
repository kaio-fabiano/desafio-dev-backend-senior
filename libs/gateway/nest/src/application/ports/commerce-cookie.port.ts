export abstract class CommerceCookiePort {
  abstract allowlisted(header: string | null | undefined): string | undefined;
}
