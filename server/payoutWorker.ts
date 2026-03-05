import { db } from './db';
import { users, transactions, payoutEntries, adminWalletTransactions } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { payoutQueue } from './payoutQueue';

/**
 * Payout Worker - Processes payout jobs in batches
 * Runs every 5 minutes in the background
 */
export class PayoutWorker {
  private static instance: PayoutWorker;
  private intervalId: NodeJS.Timeout | null = null;
  private BATCH_SIZE = 500;

  static getInstance(): PayoutWorker {
    if (!PayoutWorker.instance) {
      PayoutWorker.instance = new PayoutWorker();
    }
    return PayoutWorker.instance;
  }

  start() {
    this.intervalId = setInterval(() => {
      this.processPayoutBatches();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('Payout worker started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Payout worker stopped');
  }

  /**
   * Main processing loop
   * Gets all pending jobs and processes one batch each
   */
  private async processPayoutBatches() {
    try {
      const pendingJobs = await payoutQueue.getPendingJobs();

      for (const job of pendingJobs) {
        let currentStatus = job.status;
        if (currentStatus === 'queued') {
          // Start the job
          await payoutQueue.startJob(job.id);
          currentStatus = 'running';
        }

        if (currentStatus === 'running') {
          // Process next batch
          await this.processBatch(job.id);
        }
      }
    } catch (error) {
      console.error('Error in payout batch processing:', error);
    }
  }

  /**
   * Process a single batch of 500 entries
   */
  private async processBatch(jobId: string): Promise<void> {
    try {
      const job = await payoutQueue.getJob(jobId);
      if (!job) {
        console.error(`Job ${jobId} not found`);
        return;
      }

      // Get next batch of pending entries
      const entries = await payoutQueue.getPendingEntries(jobId, this.BATCH_SIZE);

      if (entries.length === 0) {
        // All entries processed
        await this.creditPlatformFeeToAdmin(job);
        await payoutQueue.completeJob(jobId);
        console.log(`✅ Payout job ${jobId} completed successfully`);
        return;
      }

      console.log(
        `Processing batch for job ${jobId}: ${entries.length} entries (total: ${job.totalWinners})`
      );

      // Process each entry in a transaction
      for (const entry of entries) {
        try {
          await this.processPayoutEntry(entry);
        } catch (error) {
          console.error(
            `Error processing payout entry ${entry.id} for user ${entry.userId}:`,
            error
          );
          await payoutQueue.markEntryFailed(entry.id, String(error));
        }
      }

      // Update progress
      const completedCount = await db
        .select()
        .from(payoutEntries)
        .where(eq(payoutEntries.jobId, jobId));

      await payoutQueue.updateJobProgress(jobId, completedCount.length);

      console.log(`Batch progress for job ${jobId}: ${completedCount.length}/${job.totalWinners}`);
    } catch (error) {
      console.error(`Error processing batch for job ${jobId}:`, error);
      await payoutQueue.failJob(jobId, String(error));
    }
  }

  /**
   * Credits the platform fee from a payout job to admin wallet once.
   */
  private async creditPlatformFeeToAdmin(
    job: { id: string; challengeId: number; platformFee: number }
  ): Promise<void> {
    const feeNaira = Number(job.platformFee || 0) / 100;
    if (!Number.isFinite(feeNaira) || feeNaira <= 0) {
      return;
    }

    const reference = `payout_job_${job.id}_platform_fee`;

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: adminWalletTransactions.id })
        .from(adminWalletTransactions)
        .where(eq(adminWalletTransactions.reference, reference))
        .limit(1);

      if (existing.length > 0) {
        return;
      }

      const admins = await tx
        .select({
          id: users.id,
          adminWalletBalance: users.adminWalletBalance,
          adminTotalCommission: users.adminTotalCommission,
        })
        .from(users)
        .where(eq(users.isAdmin, true))
        .limit(1);

      const admin = admins[0];
      if (!admin) {
        console.warn(
          `No admin found to receive platform fee for payout job ${job.id} (challenge ${job.challengeId})`
        );
        return;
      }

      const currentBalance = parseFloat(String(admin.adminWalletBalance || '0'));
      const currentCommission = parseFloat(String(admin.adminTotalCommission || '0'));
      const newBalance = currentBalance + feeNaira;
      const newCommission = currentCommission + feeNaira;

      await tx
        .update(users)
        .set({
          adminWalletBalance: newBalance.toFixed(2),
          adminTotalCommission: newCommission.toFixed(2),
        })
        .where(eq(users.id, admin.id));

      await tx.insert(adminWalletTransactions).values({
        adminId: admin.id,
        type: 'commission_earned',
        amount: feeNaira.toFixed(2),
        description: `Platform fee credited from payout job ${job.id}`,
        relatedId: job.challengeId,
        relatedType: 'challenge',
        reference,
        status: 'completed',
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
      });
    });
  }

  /**
   * Process a single payout entry
   */
  private async processPayoutEntry(
    entry: typeof payoutEntries.$inferSelect
  ): Promise<void> {
    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Update user balance
      await tx
        .update(users)
        .set({
          coins: sql`coins + ${entry.amount}::bigint`,
        })
        .where(eq(users.id, entry.userId));

      // Create transaction record
      await tx.insert(transactions).values({
        userId: entry.userId,
        type: 'challenge_payout',
        amount: (Number(entry.amount) / 100).toFixed(2), // Convert back to decimal
        description: `Challenge payout - Job ${entry.jobId}`,
        status: 'completed',
      });

      // Mark entry as completed
      await payoutQueue.markEntryCompleted(entry.id);

      // Trigger Payout Notification
      try {
        const { challengeNotificationTriggers } = require('./challengeNotificationTriggers');
        // amount is in kobo, convert to naira for notification message
        const amountNaira = Number(entry.amount) / 100;
        await challengeNotificationTriggers.onPayoutDelivered(
          entry.userId,
          amountNaira,
          String(entry.challengeId)
        );
      } catch (notifErr) {
        console.error('Error triggering payout notification in worker:', notifErr);
      }
    });
  }

  /**
   * Manually trigger payout processing for a job
   * Used immediately after job creation
   */
  async triggerImmediate(jobId: string) {
    try {
      const job = await payoutQueue.getJob(jobId);
      if (!job) {
        console.error(`Job ${jobId} not found`);
        return;
      }

      let currentStatus = job.status;
      if (currentStatus === 'queued') {
        await payoutQueue.startJob(jobId);
        currentStatus = 'running';
      }

      if (currentStatus === 'running') {
        await this.processBatch(jobId);
      }
    } catch (error) {
      console.error(`Error triggering immediate processing for job ${jobId}:`, error);
    }
  }
}

export const payoutWorker = PayoutWorker.getInstance();

// Auto-start the worker
payoutWorker.start();
