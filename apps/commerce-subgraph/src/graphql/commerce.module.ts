import { Module } from '@nestjs/common';

import { CommerceResolver } from './commerce.resolver.ts';

export class CommerceModule {}

Module({ providers: [CommerceResolver] })(CommerceModule);
