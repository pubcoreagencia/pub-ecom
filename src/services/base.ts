import type { RequestContext } from '../lib/context/request';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';
import { logger, type Logger } from '../lib/logging/logger';

export abstract class BaseService {
  protected readonly context: RequestContext;
  protected readonly logger: Logger;

  constructor(context: RequestContext) {
    this.context = context;
    this.logger = logger;
  }

  // Abstract method requiring subclasses to explicitly build their security boundary
  protected abstract getAuthorizationBoundary(): AuthorizationBoundary;
}
