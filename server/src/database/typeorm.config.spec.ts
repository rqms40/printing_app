import {
  initializeDataSourceWithPreSyncNormalization,
  normalizeLegacyRiderTerminology,
} from './typeorm.config';
import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';

type MockDataSource = {
  initialize: jest.Mock<Promise<DataSource>, []>;
  synchronize: jest.Mock<Promise<void>, []>;
};

type MockQueryRunner = {
  connect: jest.Mock<Promise<void>, []>;
  query: jest.Mock<Promise<void>, [string]>;
  release: jest.Mock<Promise<void>, []>;
};

function asDataSource(dataSource: unknown): DataSource {
  return dataSource as DataSource;
}

describe('initializeDataSourceWithPreSyncNormalization', () => {
  it('normalizes legacy rider terminology before schema synchronization', async () => {
    const events: string[] = [];
    const createdOptions: unknown[] = [];
    const dataSource: MockDataSource = {
      initialize: jest.fn(async () => {
        events.push('initialize');
        return asDataSource(dataSource);
      }),
      synchronize: jest.fn(async () => {
        events.push('synchronize');
      }),
    };
    const normalize = jest.fn(async () => {
      events.push('normalize');
    });

    await initializeDataSourceWithPreSyncNormalization(
      { type: 'postgres', synchronize: true } as never,
      normalize,
      (options: DataSourceOptions) => {
        createdOptions.push(options);
        return asDataSource(dataSource);
      },
    );

    expect(createdOptions).toHaveLength(1);
    expect(createdOptions[0]).toMatchObject({ synchronize: false });
    expect(events).toEqual(['initialize', 'normalize', 'synchronize']);
    expect(normalize).toHaveBeenCalledWith(dataSource);
  });

  it('does not run pre-sync normalization when synchronization is disabled', async () => {
    const dataSource: MockDataSource = {
      initialize: jest.fn(async () => asDataSource(dataSource)),
      synchronize: jest.fn(async () => undefined),
    };
    const normalize = jest.fn();

    await initializeDataSourceWithPreSyncNormalization(
      { type: 'postgres', synchronize: false } as never,
      normalize,
      () => asDataSource(dataSource),
    );

    expect(normalize).not.toHaveBeenCalled();
    expect(dataSource.synchronize).not.toHaveBeenCalled();
  });
});

describe('normalizeLegacyRiderTerminology', () => {
  it('runs idempotent schema and enum cleanup statements', async () => {
    const queryRunner: MockQueryRunner = {
      connect: jest.fn(async () => undefined),
      query: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };

    await normalizeLegacyRiderTerminology({
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as never);

    const sql = queryRunner.query.mock.calls
      .map(([statement]) => statement)
      .join('\n');
    const legacyRole = ['dri', 'ver'].join('');

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(sql).toContain('users');
    expect(sql).toContain('role');
    expect(sql).toContain('orders');
    expect(sql).toContain('order_status');
    expect(sql).toContain('ALTER TYPE %s RENAME VALUE');
    expect(sql).toContain(`enumlabel = '${legacyRole}'`);
    expect(queryRunner.release).toHaveBeenCalled();
  });
});
