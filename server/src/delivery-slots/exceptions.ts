import { ConflictException, BadRequestException } from '@nestjs/common';

export class SlotFullException extends ConflictException {
  constructor() {
    super({ message: 'Slot is full', code: 'slot_full' });
  }
}

export class CancellationClosedException extends ConflictException {
  constructor() {
    super({
      message: 'Slot is in progress, cancellation closed',
      code: 'cancellation_closed',
    });
  }
}

export class ServiceAreaMismatchException extends BadRequestException {
  constructor() {
    super({
      message: 'Address is outside service area',
      code: 'service_area_mismatch',
    });
  }
}
