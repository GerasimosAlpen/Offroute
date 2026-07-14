import { IsString, IsNumber, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignTaskDto {
  @ApiProperty({ example: "a01", description: "Incident / hazard ID" })
  @IsString()
  hazardId: string;

  @ApiProperty({ example: -6.2, description: "Base lat (radar operator position)" })
  @IsNumber()
  baseLat: number;

  @ApiProperty({ example: 106.8, description: "Base lon (radar operator position)" })
  @IsNumber()
  baseLon: number;
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ["enroute", "arrived"], example: "arrived" })
  @IsEnum(["enroute", "arrived"])
  status: "enroute" | "arrived";

  @ApiPropertyOptional({ example: -6.201, description: "Current unit latitude" })
  @IsNumber()
  @IsOptional()
  unitLat?: number;

  @ApiPropertyOptional({ example: 106.802, description: "Current unit longitude" })
  @IsNumber()
  @IsOptional()
  unitLon?: number;
}

export class UpdatePositionDto {
  @ApiProperty({ example: -6.201 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 106.802 })
  @IsNumber()
  lon: number;
}
