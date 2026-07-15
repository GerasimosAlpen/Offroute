import { IsString, IsNumber, IsIn, IsOptional, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignTaskDto {
  @ApiProperty({ example: "a01", description: "Incident / hazard ID" })
  @IsString()
  hazardId: string;

  @ApiProperty({ example: -6.2, description: "Base lat (radar operator position)" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  baseLat: number;

  @ApiProperty({ example: 106.8, description: "Base lon (radar operator position)" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  baseLon: number;
}

export class SelfAssignTaskDto {
  @ApiProperty({ example: "a01", description: "Incident / hazard ID" })
  @IsString()
  hazardId: string;

  @ApiProperty({ example: "bravo", description: "Personel taking the task themselves" })
  @IsString()
  rangerId: string;

  @ApiProperty({ example: -6.201, description: "Unit's current latitude" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  unitLat: number;

  @ApiProperty({ example: 106.802, description: "Unit's current longitude" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  unitLon: number;
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ["enroute", "arrived"], example: "arrived" })
  @IsIn(["enroute", "arrived"])
  status: "enroute" | "arrived";

  @ApiPropertyOptional({ example: -6.201, description: "Current unit latitude" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  unitLat?: number;

  @ApiPropertyOptional({ example: 106.802, description: "Current unit longitude" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  unitLon?: number;
}

export class UpdatePositionDto {
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
