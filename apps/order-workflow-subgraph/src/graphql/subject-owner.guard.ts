import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

const SUBJECT_OWNER = 'order-workflow:subject-owner';

export const RequireSubjectOwner = () => SetMetadata(SUBJECT_OWNER, true);

@Injectable()
export class SubjectOwnerGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(executionContext: ExecutionContext): boolean {
    if (
      !this.reflector.get<boolean>(SUBJECT_OWNER, executionContext.getHandler())
    ) {
      return true;
    }
    const graphql = GqlExecutionContext.create(executionContext);
    const parent = graphql.getRoot<{ id?: string }>();
    const context = graphql.getContext<{ subject?: string }>();
    return !!parent?.id && parent.id === context.subject;
  }
}
