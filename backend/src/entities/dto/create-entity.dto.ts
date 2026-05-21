import { IsString, IsNotEmpty } from 'class-validator';

export class CreateEntityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
