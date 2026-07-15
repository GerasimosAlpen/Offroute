import { IsString, IsNumber, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateMessagePinDto {
  @ApiProperty({ example: "bravo" })
  @IsString()
  rangerId: string;

  @ApiProperty({ example: "Budi" })
  @IsString()
  rangerName: string;

  @ApiProperty({ example: "TIM BRAVO" })
  @IsString()
  callsign: string;

  @ApiProperty({ example: "api berhasil dikendalikan, tidak ada korban." })
  @IsString()
  text: string;

  @ApiProperty({ example: -6.201 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 106.802 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}
