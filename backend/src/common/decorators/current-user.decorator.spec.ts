import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../auth/types/authenticated-user.js';
import { CurrentUser } from './current-user.decorator.js';

type CurrentUserParamFactory = (
  data: unknown,
  context: ExecutionContext,
) => unknown;

type ParamDecoratorMetadata = {
  factory: CurrentUserParamFactory;
};

function getCurrentUserFactory(): CurrentUserParamFactory {
  class TestController {
    handler(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
      return user;
    }
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  ) as Record<string, ParamDecoratorMetadata | undefined> | undefined;

  const paramMetadata = Object.values(metadata ?? {}).find(
    (value): value is ParamDecoratorMetadata =>
      typeof value?.factory === 'function',
  );

  if (!paramMetadata) {
    throw new Error('CurrentUser parameter metadata was not registered.');
  }

  return paramMetadata.factory;
}

describe('CurrentUser decorator', () => {
  it('should return the user attached to the HTTP request', () => {
    const factory = getCurrentUserFactory();
    const user = {
      id: 'user-123',
      email: 'test@example.com',
    } as unknown as AuthenticatedUser;

    const getRequest = vi.fn().mockReturnValue({ user });
    const switchToHttp = vi.fn().mockReturnValue({ getRequest });
    const context = { switchToHttp } as unknown as ExecutionContext;

    const result = factory('ignored-decorator-data', context);

    expect(result).toBe(user);
    expect(switchToHttp).toHaveBeenCalledTimes(1);
    expect(getRequest).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when the request has no user', () => {
    const factory = getCurrentUserFactory();

    const getRequest = vi.fn().mockReturnValue({});
    const switchToHttp = vi.fn().mockReturnValue({ getRequest });
    const context = { switchToHttp } as unknown as ExecutionContext;

    const result = factory(undefined, context);

    expect(result).toBeUndefined();
    expect(getRequest).toHaveBeenCalledTimes(1);
  });
});
