import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}

export class ReplySupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  replyMessage: string;
}
