import { Body, Controller, Get, Put } from "@nestjs/common";
import type { OrganisationSettingsView } from "@sahmati/contracts";
import { SettingsService } from "../services/settings.service";
import { UpdateSettingsDto } from "../dto/update-settings.dto";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<OrganisationSettingsView> {
    return this.settings.get();
  }

  @Roles("owner")
  @Put()
  update(@Body() dto: UpdateSettingsDto): Promise<OrganisationSettingsView> {
    return this.settings.update(dto);
  }
}
