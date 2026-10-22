import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceProjectMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
