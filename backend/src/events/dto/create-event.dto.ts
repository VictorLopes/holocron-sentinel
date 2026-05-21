import { IsString, IsNotEmpty, IsIn, IsObject } from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty()
  entity_id!: string | number;

  @IsString()
  @IsNotEmpty()
  external_id!: string;

  @IsString()
  @IsIn(['info', 'warning', 'critical'])
  type!: 'info' | 'warning' | 'critical';

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, any>;
}
