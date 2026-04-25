import { DailyGridGateway } from './daily-grid.gateway';

describe('DailyGridGateway', () => {
  let gateway: DailyGridGateway;

  beforeEach(() => {
    gateway = new DailyGridGateway();
    gateway.server = { emit: jest.fn() } as any;
  });

  it('notifyUpdated emits dailyGridUpdated with empty payload', () => {
    gateway.notifyUpdated();
    expect(gateway.server.emit).toHaveBeenCalledWith('dailyGridUpdated', {});
  });
});
