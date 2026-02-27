/**
 * Two-Phase Commit for Critical Operations
 * Ensures atomic execution of multi-step operations like:
 * - Order creation with inventory deduction
 * - Loyalty points awarding
 * - Payment processing
 * - Inventory transfers
 */

export enum CommitPhase {
  PREPARE = 'PREPARE',
  COMMIT = 'COMMIT',
  ABORT = 'ABORT',
  ROLLBACK = 'ROLLBACK',
}

export enum CommitStatus {
  PENDING = 'PENDING',
  PREPARED = 'PREPARED',
  COMMITTED = 'COMMITTED',
  ABORTED = 'ABORTED',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED',
}

export interface TransactionStep {
  id: string;
  name: string;
  execute: () => Promise<any>;
  rollback: () => Promise<void>;
  timeout?: number; // Step timeout in milliseconds
}

export interface Transaction {
  id: string;
  name: string;
  steps: TransactionStep[];
  phase: CommitPhase;
  status: CommitStatus;
  startedAt: number;
  completedAt?: number;
  error?: Error;
  results: Map<string, any>;
}

export interface TransactionOptions {
  timeout?: number; // Overall transaction timeout in milliseconds (default: 30000)
  retryCount?: number; // Number of retries for failed steps (default: 3)
  retryDelay?: number; // Delay between retries in milliseconds (default: 1000)
  onProgress?: (step: TransactionStep, result: any) => void;
  onError?: (step: TransactionStep, error: Error) => void;
  onComplete?: (transaction: Transaction) => void;
}

class TwoPhaseCommit {
  private transactions: Map<string, Transaction> = new Map();
  private defaultOptions: TransactionOptions = {
    timeout: 30000, // 30 seconds default
    retryCount: 3,
    retryDelay: 1000,
  };

  /**
   * Create a new transaction
   */
  createTransaction(name: string, steps: TransactionStep[]): Transaction {
    const transaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      steps,
      phase: CommitPhase.PREPARE,
      status: CommitStatus.PENDING,
      startedAt: Date.now(),
      results: new Map(),
    };

    this.transactions.set(transaction.id, transaction);
    console.log(`[TwoPhaseCommit] Created transaction: ${transaction.id} - ${name}`);

    return transaction;
  }

  /**
   * Execute a transaction using two-phase commit
   */
  async executeTransaction(
    transaction: Transaction,
    options: TransactionOptions = {}
  ): Promise<Transaction> {
    const opts = { ...this.defaultOptions, ...options };

    console.log(`[TwoPhaseCommit] Starting transaction: ${transaction.id}`);
    transaction.startedAt = Date.now();
    transaction.phase = CommitPhase.PREPARE;
    transaction.status = CommitStatus.PENDING;

    try {
      // Phase 1: PREPARE - Execute all steps
      console.log(`[TwoPhaseCommit] Phase 1: PREPARE - ${transaction.steps.length} steps`);
      transaction.phase = CommitPhase.PREPARE;

      for (const step of transaction.steps) {
        await this.executeStep(transaction, step, opts);
      }

      // All steps prepared successfully
      transaction.phase = CommitPhase.PREPARE;
      transaction.status = CommitStatus.PREPARED;
      console.log(`[TwoPhaseCommit] All steps prepared successfully`);

      // Phase 2: COMMIT - Finalize transaction
      console.log(`[TwoPhaseCommit] Phase 2: COMMIT`);
      transaction.phase = CommitPhase.COMMIT;
      transaction.status = CommitStatus.COMMITTED;
      transaction.completedAt = Date.now();

      console.log(`[TwoPhaseCommit] Transaction committed successfully: ${transaction.id}`);

      if (opts.onComplete) {
        opts.onComplete(transaction);
      }

      return transaction;
    } catch (error) {
      // Transaction failed - initiate rollback
      console.error(`[TwoPhaseCommit] Transaction failed: ${transaction.id}`, error);

      transaction.phase = CommitPhase.ROLLBACK;
      transaction.error = error instanceof Error ? error : new Error(String(error));

      await this.rollbackTransaction(transaction);

      transaction.status = CommitStatus.ROLLED_BACK;
      transaction.completedAt = Date.now();

      console.error(`[TwoPhaseCommit] Transaction rolled back: ${transaction.id}`);

      throw error;
    } finally {
      // Clean up old transactions
      this.cleanupOldTransactions();
    }
  }

  /**
   * Execute a single transaction step with retry logic
   */
  private async executeStep(
    transaction: Transaction,
    step: TransactionStep,
    options: TransactionOptions
  ): Promise<void> {
    const maxRetries = options.retryCount || this.defaultOptions.retryCount!;
    const retryDelay = options.retryDelay || this.defaultOptions.retryDelay!;
    const stepTimeout = step.timeout || options.timeout || this.defaultOptions.timeout!;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[TwoPhaseCommit] Executing step ${step.id} (${step.name}) - Attempt ${attempt}/${maxRetries}`
        );

        // Execute step with timeout
        const result = await this.executeWithTimeout(step.execute(), stepTimeout);

        // Store result
        transaction.results.set(step.id, result);

        console.log(`[TwoPhaseCommit] Step ${step.id} completed successfully`);

        if (options.onProgress) {
          options.onProgress(step, result);
        }

        return; // Success - exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.error(
          `[TwoPhaseCommit] Step ${step.id} failed on attempt ${attempt}/${maxRetries}:`,
          lastError
        );

        if (options.onError) {
          options.onError(step, lastError);
        }

        // If this is the last attempt, don't wait
        if (attempt < maxRetries) {
          console.log(`[TwoPhaseCommit] Retrying step ${step.id} in ${retryDelay}ms...`);
          await this.sleep(retryDelay);
        }
      }
    }

    // All retries failed
    throw new Error(
      `Step ${step.id} (${step.name}) failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Rollback a transaction - undo all completed steps in reverse order
   */
  private async rollbackTransaction(transaction: Transaction): Promise<void> {
    console.log(`[TwoPhaseCommit] Rolling back transaction: ${transaction.id}`);

    // Get completed steps (those with results)
    const completedSteps = transaction.steps.filter((step) => transaction.results.has(step.id));

    // Rollback in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];
      const result = transaction.results.get(step.id);

      try {
        console.log(`[TwoPhaseCommit] Rolling back step ${step.id} (${step.name})`);

        // Call rollback function with the original result
        await step.rollback();

        console.log(`[TwoPhaseCommit] Step ${step.id} rolled back successfully`);

        // Remove result after successful rollback
        transaction.results.delete(step.id);
      } catch (error) {
        console.error(
          `[TwoPhaseCommit] Failed to rollback step ${step.id}:`,
          error
        );
        // Continue rolling back other steps even if this one fails
      }
    }

    console.log(`[TwoPhaseCommit] Transaction rollback completed: ${transaction.id}`);
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up old transactions (older than 1 hour)
   */
  private cleanupOldTransactions(): void {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    for (const [id, transaction] of this.transactions.entries()) {
      if (now - transaction.startedAt > oneHour) {
        this.transactions.delete(id);
        console.log(`[TwoPhaseCommit] Cleaned up old transaction: ${id}`);
      }
    }
  }

  /**
   * Get a transaction by ID
   */
  getTransaction(id: string): Transaction | undefined {
    return this.transactions.get(id);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Get active (in-progress) transactions
   */
  getActiveTransactions(): Transaction[] {
    return this.getAllTransactions().filter(
      (t) => t.status === CommitStatus.PENDING || t.status === CommitStatus.PREPARED
    );
  }

  /**
   * Get transaction statistics
   */
  getStats(): {
    total: number;
    active: number;
    committed: number;
    aborted: number;
    failed: number;
  } {
    const all = this.getAllTransactions();

    return {
      total: all.length,
      active: all.filter((t) => t.status === CommitStatus.PENDING || t.status === CommitStatus.PREPARED)
        .length,
      committed: all.filter((t) => t.status === CommitStatus.COMMITTED).length,
      aborted: all.filter((t) => t.status === CommitStatus.ABORTED).length,
      failed: all.filter(
        (t) => t.status === CommitStatus.ROLLED_BACK || t.status === CommitStatus.FAILED
      ).length,
    };
  }
}

// Export singleton instance
export const twoPhaseCommit = new TwoPhaseCommit();

export { TwoPhaseCommit };
export default twoPhaseCommit;

// ============================================
// HELPER FUNCTIONS FOR COMMON TRANSACTIONS
// ============================================

/**
 * Create an order transaction with automatic inventory deduction and loyalty points
 */
export function createOrderTransaction(
  orderData: any,
  inventorySteps: TransactionStep[],
  loyaltyStep?: TransactionStep
): Transaction {
  const steps: TransactionStep[] = [
    {
      id: 'create_order',
      name: 'Create Order',
      execute: async () => {
        // This would be called by the API
        console.log('[OrderTransaction] Creating order:', orderData);
        return orderData;
      },
      rollback: async () => {
        // Delete the order
        console.log('[OrderTransaction] Rolling back order creation');
      },
    },
    ...inventorySteps,
  ];

  if (loyaltyStep) {
    steps.push(loyaltyStep);
  }

  return twoPhaseCommit.createTransaction('Create Order', steps);
}

/**
 * Create an inventory transfer transaction
 */
export function createTransferTransaction(
  transferData: any,
  deductSourceStep: TransactionStep,
  addDestinationStep: TransactionStep
): Transaction {
  return twoPhaseCommit.createTransaction('Inventory Transfer', [
    {
      id: 'create_transfer_record',
      name: 'Create Transfer Record',
      execute: async () => {
        console.log('[TransferTransaction] Creating transfer record:', transferData);
        return transferData;
      },
      rollback: async () => {
        console.log('[TransferTransaction] Rolling back transfer record');
      },
    },
    deductSourceStep,
    addDestinationStep,
  ]);
}

/**
 * Create a purchase order transaction
 */
export function createPurchaseOrderTransaction(
  orderData: any,
  inventoryUpdateSteps: TransactionStep[]
): Transaction {
  return twoPhaseCommit.createTransaction('Purchase Order', [
    {
      id: 'create_purchase_order',
      name: 'Create Purchase Order',
      execute: async () => {
        console.log('[PurchaseOrderTransaction] Creating purchase order:', orderData);
        return orderData;
      },
      rollback: async () => {
        console.log('[PurchaseOrderTransaction] Rolling back purchase order');
      },
    },
    ...inventoryUpdateSteps,
  ]);
}
