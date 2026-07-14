import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCommsEntryDto {
  @ApiProperty({ example: "TIM BRAVO" })
  @IsString()
  sender: string;

  @ApiProperty({ example: "#5fb3b3" })
  @IsString()
  color: string;

  @ApiProperty({ example: "TUGAS DITERIMA" })
  @IsString()
  lead: string;

  @ApiProperty({ example: "menuju lokasi kebakaran, menghitung rute." })
  @IsString()
  body: string;
}
