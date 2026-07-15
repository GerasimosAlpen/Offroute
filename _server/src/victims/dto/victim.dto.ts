import { IsString, IsNumber, IsOptional, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SosPingDto {
  @ApiProperty({ example: "a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7", description: "Client-generated UUID, stable across pings from the same device" })
  @IsString()
  id: string;

  @ApiPropertyOptional({ example: "Pak Budi, lantai 2" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: -6.2088 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 106.8456 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}

export class RangerRefDto {
  @ApiProperty({ example: "bravo" })
  @IsString()
  rangerId: string;

  @ApiProperty({ example: "Budi" })
  @IsString()
  rangerName: string;

  @ApiProperty({ example: "TIM BRAVO" })
  @IsString()
  callsign: string;
}
