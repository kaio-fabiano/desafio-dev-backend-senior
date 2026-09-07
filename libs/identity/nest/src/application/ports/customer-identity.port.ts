import { RegisterIdentityCommand } from '../commands/register-identity.command.ts';

export abstract class CustomerIdentityPort {
  abstract createCustomer(command: RegisterIdentityCommand): Promise<string>;
  abstract deleteCustomer(customerId: string): Promise<void>;
  abstract linkSubject(customerId: string, subject: string): Promise<void>;
}
