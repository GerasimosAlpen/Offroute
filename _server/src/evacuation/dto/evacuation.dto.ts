import { IsString, IsNumber, Max, Min } from "class-validator";
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
  @Min(-90)
  @Max(90)
  atLat: number;

  @ApiProperty({ example: 106.802 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  atLon: number;

  @ApiProperty({ example: -6.2, description: "Incident epicenter lat" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  incidentLat: number;

  @ApiProperty({ example: 106.8, description: "Incident epicenter lon" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  incidentLon: number;
}
