import { IsString, IsEnum, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum HazardKindDto {
  fire = "fire",
  blocked = "blocked",
  medical = "medical",
  crash = "crash",
  theft = "theft",
}

export enum HazardSeverityDto {
  critical = "critical",
  warning = "warning",
  info = "info",
}

export class CreateIncidentDto {
  @ApiProperty({ enum: HazardKindDto, example: "fire" })
  @IsEnum(HazardKindDto)
  kind: HazardKindDto;

  @ApiProperty({ example: "A01 - API" })
  @IsString()
  label: string;

  @ApiProperty({ example: "Sektor Utara. Butuh bantuan pemadaman segera." })
  @IsString()
  description: string;

  @ApiProperty({ enum: HazardSeverityDto, example: "critical" })
  @IsEnum(HazardSeverityDto)
  severity: HazardSeverityDto;

  @ApiProperty({ example: 0.004, description: "Lat offset from base position" })
  @IsNumber()
  offsetLat: number;

  @ApiProperty({ example: -0.002, description: "Lon offset from base position" })
  @IsNumber()
  offsetLon: number;
}
