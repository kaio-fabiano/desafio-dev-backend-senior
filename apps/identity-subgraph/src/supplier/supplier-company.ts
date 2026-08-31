export type SupplierCompany = {
  id: string;
  name: string;
  memberships: Array<{
    userId: string;
    role: 'owner' | 'manager';
    validFrom: Date;
    validUntil?: Date;
  }>;
};
