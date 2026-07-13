import { validate } from 'class-validator';
import {
  CreateDispatchPlanDto,
  ReoptimizeDispatchPlanDto,
} from './create-dispatch-plan.dto';

describe('dispatch plan DTOs', () => {
  it.each([
    [[], 'empty'],
    [[1, 1], 'duplicate'],
    [[1, 2, 3, 4, 5, 6], 'more than five'],
    [[1, -2], 'non-positive'],
    [[1, 2.5], 'non-integer'],
  ])('rejects %s assignment ids (%s)', async (assignmentIds) => {
    const dto = Object.assign(new CreateDispatchPlanDto(), { assignmentIds });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('accepts one to five unique positive integer assignment ids', async () => {
    const dto = Object.assign(new CreateDispatchPlanDto(), {
      assignmentIds: [5, 2, 9],
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows re-optimization to reuse all current assignments when omitted', async () => {
    await expect(
      validate(new ReoptimizeDispatchPlanDto()),
    ).resolves.toHaveLength(0);
  });
});
