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

  it('notifyUpdated does not throw when server is undefined', () => {
    gateway.server = undefined as any;
    expect(() => gateway.notifyUpdated()).not.toThrow();
  });
});
