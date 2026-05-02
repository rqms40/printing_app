import { PartialType } from '@nestjs/swagger';

import { CreateSpecDefinitionDto } from './create-spec-definition.dto';

export class UpdateSpecDefinitionDto extends PartialType(
  CreateSpecDefinitionDto,
) {}
