import { PartialType } from '@nestjs/swagger';

import { CreateSpecOptionV2Dto } from './create-spec-option-v2.dto';

export class UpdateSpecOptionV2Dto extends PartialType(CreateSpecOptionV2Dto) {}
