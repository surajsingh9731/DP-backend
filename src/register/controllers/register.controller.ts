import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import type {
  RegisterContextView,
  RegisterEntryView,
} from "@sahmati/contracts";
import { RegisterService } from "../services/register.service";
import { CreateRegisterEntryDto } from "../dto/create-register-entry.dto";
import { UpdateRegisterEntryDto } from "../dto/update-register-entry.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("register")
export class RegisterController {
  constructor(private readonly register: RegisterService) {}

  @Get("context")
  context(): Promise<RegisterContextView> {
    return this.register.context();
  }

  @Get()
  list(): Promise<RegisterEntryView[]> {
    return this.register.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.register.get(id);
  }

  @Roles("owner", "staff")
  @Post()
  create(
    @Body() dto: CreateRegisterEntryDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RegisterEntryView> {
    return this.register.create(dto, session);
  }

  @Roles("owner", "staff")
  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRegisterEntryDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<RegisterEntryView> {
    return this.register.update(id, dto, session);
  }
}
