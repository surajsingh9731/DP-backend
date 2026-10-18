import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type {
  TrainingCertificateView,
  TrainingLessonDetailView,
  TrainingLessonSummary,
  TrainingQuizResultView,
} from "@sahmati/contracts";
import { TrainingService } from "../services/training.service";
import { SubmitQuizDto } from "../dto/submit-quiz.dto";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Controller("training")
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get("lessons")
  listLessons(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<TrainingLessonSummary[]> {
    return this.training.listLessons(session);
  }

  @Get("lessons/:code")
  getLessonDetail(
    @Param("code") code: string,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<TrainingLessonDetailView> {
    return this.training.getLessonDetail(code, session);
  }

  @Post("lessons/:code/submit")
  submitQuiz(
    @Param("code") code: string,
    @Body() dto: SubmitQuizDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<TrainingQuizResultView> {
    return this.training.submitQuiz(code, dto, session);
  }

  @Get("certificates")
  myCertificates(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<TrainingCertificateView[]> {
    return this.training.myCertificates(session);
  }
}
