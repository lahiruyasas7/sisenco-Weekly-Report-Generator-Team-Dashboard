import {
  IsByteLength,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @IsString()
  @Length(12, 72, { message: 'Password must be 12–72 characters long.' })
  @IsByteLength(12, 72)
  @Matches(/^(?!\s+$)/, { message: 'Password cannot be only whitespace.' })
  password: string;
}
