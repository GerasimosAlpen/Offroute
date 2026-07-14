import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { MessagesService } from "./messages.service";
import { CreateMessagePinDto } from "./dto/message.dto";

@ApiTags("messages")
@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("pins")
  @ApiOperation({ summary: "List all geotagged message pins" })
  @ApiResponse({ status: 200, description: "Array of MessagePin matching messagePins.ts shape" })
  findAll() {
    return this.messagesService.findAll();
  }

  @Post("pin")
  @ApiOperation({ summary: "Post a geotagged status message from personel. Emits message-pin WS event." })
  @ApiBody({ type: CreateMessagePinDto })
  @ApiResponse({ status: 201, description: "MessagePin persisted and broadcast to all clients" })
  addPin(@Body() dto: CreateMessagePinDto) {
    return this.messagesService.addPin(dto);
  }
}
