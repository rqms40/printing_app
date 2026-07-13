import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class CreateDispatchPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  assignmentIds: number[];
}

export class ReoptimizeDispatchPlanDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  assignmentIds?: number[];
}
