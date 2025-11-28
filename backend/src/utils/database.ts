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

