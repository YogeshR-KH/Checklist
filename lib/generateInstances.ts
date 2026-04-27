import { prisma } from './prisma';
import { isDueOn } from './frequency';
import { combineDateAndTime, todayUTC } from './dates';

export type GenerateResult = {
  date: string;
  considered: number;
  created: number;
  skipped: number;
  swappedToBackup: number;
};

/**
 * Generates task_instances for a given date (default: today).
 * Idempotent — relies on the unique (task_id, due_date) constraint.
 */
export async function generateInstancesForDate(date: Date = todayUTC()): Promise<GenerateResult> {
  const tasks = await prisma.task.findMany({
    where: { isActive: true, company: { isActive: true } }
  });

  const dateStr = date.toISOString().slice(0, 10);

  const absences = await prisma.absentLog.findMany({ where: { absentDate: date } });
  const absentDoers = new Set(absences.map((a) => a.doerId));

  let created = 0;
  let skipped = 0;
  let swapped = 0;

  for (const task of tasks) {
    const due = isDueOn(task.frequency, task.frequencyConfig as any, date);
    if (!due) { skipped++; continue; }

    const exists = await prisma.taskInstance.findUnique({
      where: { taskId_dueDate: { taskId: task.id, dueDate: date } }
    });
    if (exists) { skipped++; continue; }

    let doerId = task.doerId;
    let isAbsentSwap = false;
    if (absentDoers.has(task.doerId) && task.backupDoerId) {
      doerId = task.backupDoerId;
      isAbsentSwap = true;
      swapped++;
    }

    await prisma.taskInstance.create({
      data: {
        taskId: task.id,
        companyId: task.companyId,
        doerId,
        pcId: task.pcId,
        dueDate: date,
        dueDatetime: combineDateAndTime(date, task.deadlineTime),
        status: 'pending',
        isAbsentSwap
      }
    });
    created++;
  }

  return { date: dateStr, considered: tasks.length, created, skipped, swappedToBackup: swapped };
}

/**
 * Sweeps any pending instances whose due_datetime has passed and flips them to 'overdue'.
 */
export async function markPastDueOverdue(): Promise<number> {
  const res = await prisma.taskInstance.updateMany({
    where: { status: 'pending', dueDatetime: { lt: new Date() } },
    data: { status: 'overdue' }
  });
  return res.count;
}
