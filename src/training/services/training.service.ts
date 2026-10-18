import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  TrainingCertificateView,
  TrainingLessonDetailView,
  TrainingLessonSummary,
  TrainingQuizResultView,
} from "@sahmati/contracts";
import { TrainingProgressEntity } from "../entities/training-progress.entity";
import { SubmitQuizDto } from "../dto/submit-quiz.dto";
import { TRAINING_LESSONS, findLesson } from "../data/lessons";
import { TenantContextService } from "../../common/services/tenant-context.service";
import type { AuthenticatedSession } from "../../common/guards/session.guard";

@Injectable()
export class TrainingService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async listLessons(
    session: AuthenticatedSession,
  ): Promise<TrainingLessonSummary[]> {
    const tenantId = this.tenantId();
    const rows = await this.tenantContext
      .repo(TrainingProgressEntity)
      .find({ where: { tenantId, userId: session.userId } });
    const byLesson = new Map(rows.map((row) => [row.lessonCode, row]));

    return TRAINING_LESSONS.map((lesson) => {
      const progress = byLesson.get(lesson.code);
      return {
        code: lesson.code,
        title: lesson.title,
        summary: lesson.summary,
        status: progress?.status ?? "not_started",
        quizScore: progress?.quizScore ?? null,
        certificateId: progress?.certificateId ?? null,
      };
    });
  }

  async getLessonDetail(
    code: string,
    session: AuthenticatedSession,
  ): Promise<TrainingLessonDetailView> {
    const lesson = findLesson(code);
    if (!lesson) throw new NotFoundException("Lesson not found.");

    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();
    const repo = manager.getRepository(TrainingProgressEntity);
    const existing = await repo.findOne({
      where: { tenantId, userId: session.userId, lessonCode: code },
    });
    if (!existing) {
      await manager.save(
        repo.create({
          tenantId,
          userId: session.userId,
          lessonCode: code,
          status: "in_progress",
          startedAt: new Date(),
        }),
      );
    } else if (existing.status === "not_started") {
      existing.status = "in_progress";
      existing.startedAt = new Date();
      await manager.save(existing);
    }

    return {
      code: lesson.code,
      title: lesson.title,
      content: lesson.content,
      quiz: lesson.quiz.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
      })),
    };
  }

  async submitQuiz(
    code: string,
    dto: SubmitQuizDto,
    session: AuthenticatedSession,
  ): Promise<TrainingQuizResultView> {
    const lesson = findLesson(code);
    if (!lesson) throw new NotFoundException("Lesson not found.");

    const manager = this.tenantContext.manager;
    const tenantId = this.tenantId();
    const repo = manager.getRepository(TrainingProgressEntity);
    const existing = await repo.findOne({
      where: { tenantId, userId: session.userId, lessonCode: code },
    });

    const correctCount = lesson.quiz.reduce(
      (count, question, index) =>
        dto.answers[index] === question.correctIndex ? count + 1 : count,
      0,
    );
    const score = Math.round((correctCount / lesson.quiz.length) * 100);
    const passed = score >= lesson.passingScore;

    const row =
      existing ??
      repo.create({
        tenantId,
        userId: session.userId,
        lessonCode: code,
        status: "in_progress",
      });
    row.quizScore = score;
    if (passed) {
      row.status = "completed";
      row.certificateId = row.certificateId ?? randomUUID();
      row.completedAt = row.completedAt ?? new Date();
    }
    await manager.save(row);

    return { passed, score, certificateId: row.certificateId };
  }

  async myCertificates(
    session: AuthenticatedSession,
  ): Promise<TrainingCertificateView[]> {
    const tenantId = this.tenantId();
    const rows = await this.tenantContext.repo(TrainingProgressEntity).find({
      where: { tenantId, userId: session.userId },
      order: { completedAt: "DESC" },
    });
    return rows
      .filter((row) => row.certificateId !== null && row.completedAt !== null)
      .map((row) => {
        const lesson = findLesson(row.lessonCode);
        return {
          certificateId: row.certificateId!,
          lessonCode: row.lessonCode,
          lessonTitle: lesson?.title ?? {
            en: row.lessonCode,
            hi: row.lessonCode,
          },
          issuedAt: row.completedAt!.toISOString(),
        };
      });
  }

  private tenantId(): string {
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId)
      throw new Error(
        "No tenant context — this endpoint requires an authenticated session.",
      );
    return tenantId;
  }
}
