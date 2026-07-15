import { Controller, Get, Query, Req, Res, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ProxyService } from "./proxy.service";

@ApiTags("proxy")
@Controller("proxy")
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get()
  @ApiOperation({ summary: "Fetch a page/asset with frame-blocking stripped, for the in-OS browser" })
  @ApiQuery({ name: "url", description: "Absolute http(s) URL to fetch" })
  async get(@Query("url") url: string, @Req() req: Request, @Res() res: Response) {
    if (!url) throw new BadRequestException("Parameter 'url' wajib diisi");
    const selfOrigin = `${req.protocol}://${req.get("host")}`;
    const result = await this.proxy.fetch(url, selfOrigin);
    this.sendFramable(res, result);
  }

  @Get("search")
  @ApiOperation({ summary: "Web search that renders a framable results page (keyless multi-source)" })
  @ApiQuery({ name: "q", description: "Search query" })
  async search(@Query("q") q: string, @Req() req: Request, @Res() res: Response) {
    const selfOrigin = `${req.protocol}://${req.get("host")}`;
    const result = await this.proxy.search(q ?? "", selfOrigin);
    this.sendFramable(res, result);
  }

  private sendFramable(res: Response, result: { contentType: string; body: Buffer | string }) {
    // The whole point: never let the content forbid being framed.
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", result.contentType);
    res.send(result.body);
  }
}
