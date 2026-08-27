export type AuthContext = {
  subject: string;
  scopes: readonly string[];
  audience: readonly string[];
  supplierCompanyId?: string;
  requestId: string;
};
