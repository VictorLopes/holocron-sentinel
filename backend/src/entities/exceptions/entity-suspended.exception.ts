import { ConflictException } from '@nestjs/common';

export class EntitySuspendedException extends ConflictException {
  constructor(
    message = 'Monitored entity is suspended and cannot accept new events',
  ) {
    super(message);
  }
}
