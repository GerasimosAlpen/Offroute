import { IsString, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateEvacRequestDto {
  @ApiProperty({ example: "bravo" })
  @IsString()
  rangerId: string;

  @ApiProperty({ example: "Budi" })
  @IsString()
  rangerName: string;

  @ApiProperty({ example: "TIM BRAVO" })
  @IsString()
  callsign: string;

  @ApiProperty({ example: -6.201 })
  @IsNumber()
  atLat: number;

  @ApiProperty({ example: 106.802 })
  @IsNumber()
  atLon: number;

  @ApiProperty({ example: -6.2, description: "Incident epicenter lat" })
  @IsNumber()
  incidentLat: number;

  @ApiProperty({ example: 106.8, description: "Incident epicenter lon" })
  @IsNumber()
  incidentLon: number;
}
