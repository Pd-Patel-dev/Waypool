import { prisma, pool } from '../lib/prisma';

/**
 * Test database connection
 * @returns Promise<boolean> - true if connection is successful
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    // Test query to ensure database is accessible
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

/**
 * Check if database migrations are up to date
 * @returns Promise<{ isUpToDate: boolean; pendingMigrations?: string[]; error?: string }>
 */
export async function checkMigrationStatus(): Promise<{
  isUpToDate: boolean;
  pendingMigrations?: string[];
  error?: string;
}> {
  try {
    // Check if _prisma_migrations table exists (indicates migrations have been run)
    const migrationTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_prisma_migrations'
      ) as exists
    `;

    if (!migrationTableExists[0]?.exists) {
      return {
        isUpToDate: false,
        pendingMigrations: ['Database not initialized - run migrations'],
      };
    }

    // Get count of applied migrations
    const migrationCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;

    const count = Number(migrationCount[0]?.count || 0);

    if (count === 0) {
      return {
        isUpToDate: false,
        pendingMigrations: ['No migrations have been applied'],
      };
    }

    // Basic check: if migrations table exists and has entries, assume up to date
    // For a more thorough check, users should run `prisma migrate status` manually
    // This is a lightweight check that doesn't require running external commands
    return { isUpToDate: true };
  } catch (error) {
    return {
      isUpToDate: false,
      error: error instanceof Error ? error.message : 'Unknown error checking migrations',
    };
  }
}

/**
 * Get database connection status
 * @returns Promise<{ connected: boolean; error?: string }>
 */
export async function getDatabaseStatus(): Promise<{ connected: boolean; error?: string }> {
  try {
    const isConnected = await testDatabaseConnection();
    return { connected: isConnected };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
}

