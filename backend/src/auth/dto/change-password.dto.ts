import { IsByteLength, IsString } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsByteLength(1, 72)
  currentPassword!: string;

  @IsString()
  @IsByteLength(15, 72)
  newPassword!: string;
}
