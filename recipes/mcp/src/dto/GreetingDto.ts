import { IsString, Length } from 'class-validator';
export class GreetingDto {
  @IsString()
  @Length(1, 80)
  name!: string;
}
