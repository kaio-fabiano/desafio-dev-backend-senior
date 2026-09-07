import { Inject, Injectable } from '@nestjs/common';

import { RegisterIdentityCommand } from '../../application/commands/register-identity.command.ts';
import { CustomerIdentityPort } from '../../application/ports/customer-identity.port.ts';
import { WordPressIdentityService } from '../../wordpress/wordpress-identity.service.ts';

@Injectable()
export class WordPressCustomerIdentityAdapter implements CustomerIdentityPort {
  constructor(
    @Inject(WordPressIdentityService)
    private readonly wordpress: WordPressIdentityService,
  ) {}

  async createCustomer(command: RegisterIdentityCommand): Promise<string> {
    return (await this.wordpress.createCustomer(command)).id;
  }

  deleteCustomer(customerId: string): Promise<void> {
    return this.wordpress.deleteCustomer(customerId);
  }

  linkSubject(customerId: string, subject: string): Promise<void> {
    return this.wordpress.linkSubject(customerId, subject);
  }
}
