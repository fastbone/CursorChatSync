import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { DbReader } from './dbReader';

export interface BackupInfo {
  id: string;
  timestamp: Date;
  workspacePath: string | null;
  globalStorageBackedUp: boolean;
  workspaceStorageBackedUp: boolean;
  workspaceCursorBackedUp: boolean;
  backupPath: string;
  checksum: string;
  size: number;
}

export interface BackupMetadata {
  version: string;
  createdAt: string;
  workspacePath: string | null;
  sources: {
    globalStorage?: { path: string; checksum: string; size: number };
    workspaceStorage?: { path: string; checksum: string; size: number };
    workspaceCursor?: { path: string; checksum: string; size: number };
  };
}

export class BackupService {
  private backupDir: string;
  private maxBackups: number = 10; // Keep last 10 backups
  private reader: DbReader;

  constructor(workspacePath?: string, maxBackups?: number) {
    this.reader = new DbReader(workspacePath);
    
    // Store backups in a safe location: ~/.cursor-chat-sync/backups
    const backupBaseDir = path.join(os.homedir(), '.cursor-chat-sync', 'backups');
    this.backupDir = backupBaseDir;
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Set max backups from config if provided
    if (maxBackups !== undefined) {
      this.setMaxBackups(maxBackups);
    }
  }

  /**
   * Create a backup of all chat history sources before any write operation
   * Returns backup info for potential restore
   */
  async createBackup(): Promise<BackupInfo> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const backupPath = path.join(this.backupDir, backupId);
    
    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    const sources: BackupMetadata['sources'] = {};
    let globalStorageBackedUp = false;
    let workspaceStorageBackedUp = false;
    let workspaceCursorBackedUp = false;

    // Backup global storage
    try {
      const globalPath = this.reader.getDbPath();
      if (fs.existsSync(globalPath)) {
        const backup = await this.backupDatabase(globalPath, path.join(backupPath, 'globalStorage.vscdb'));
        sources.globalStorage = backup;
        globalStorageBackedUp = true;
      }
    } catch (error: any) {
      console.warn(`Failed to backup global storage: ${error.message}`);
    }

    // Backup workspace storage (if available)
    const workspaceStoragePath = this.reader.getWorkspaceStoragePath();
    if (workspaceStoragePath && fs.existsSync(workspaceStoragePath)) {
      try {
        const backup = await this.backupDatabase(workspaceStoragePath, path.join(backupPath, 'workspaceStorage.vscdb'));
        sources.workspaceStorage = backup;
        workspaceStorageBackedUp = true;
      } catch (error: any) {
        console.warn(`Failed to backup workspace storage: ${error.message}`);
      }
    }

    // Backup workspace .cursor directory (if available)
    const workspaceCursorPath = this.reader.getWorkspaceCursorPath();
    if (workspaceCursorPath && fs.existsSync(workspaceCursorPath)) {
      try {
        const backup = await this.backupDatabase(workspaceCursorPath, path.join(backupPath, 'workspaceCursor.vscdb'));
        sources.workspaceCursor = backup;
        workspaceCursorBackedUp = true;
      } catch (error: any) {
        console.warn(`Failed to backup workspace .cursor: ${error.message}`);
      }
    }

    // Create metadata file
    const metadata: BackupMetadata = {
      version: '1.0',
      createdAt: timestamp.toISOString(),
      workspacePath: this.reader.getWorkspacePath() || null,
      sources,
    };

    const metadataPath = path.join(backupPath, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Calculate total backup size
    const totalSize = Object.values(sources).reduce((sum, source) => sum + (source?.size || 0), 0);

    // Calculate checksum of metadata file content
    const metadataContent = fs.readFileSync(metadataPath, 'utf8');
    const checksum = this.calculateChecksum(metadataContent);

    const backupInfo: BackupInfo = {
      id: backupId,
      timestamp,
      workspacePath: this.reader.getWorkspacePath() || null,
      globalStorageBackedUp,
      workspaceStorageBackedUp,
      workspaceCursorBackedUp,
      backupPath,
      checksum,
      size: totalSize,
    };

    // Save backup info
    const infoPath = path.join(backupPath, 'backup-info.json');
    fs.writeFileSync(infoPath, JSON.stringify(backupInfo, null, 2), 'utf8');

    // Cleanup old backups
    await this.cleanupOldBackups();

    return backupInfo;
  }

  /**
   * Backup a single database file atomically
   */
  private async backupDatabase(sourcePath: string, targetPath: string): Promise<{ path: string; checksum: string; size: number }> {
    // Use atomic copy: copy to temp file first, then rename
    const tempPath = `${targetPath}.tmp`;
    
    // Copy file
    fs.copyFileSync(sourcePath, tempPath);
    
    // Verify copy
    const sourceChecksum = this.calculateFileChecksum(sourcePath);
    const tempChecksum = this.calculateFileChecksum(tempPath);
    
    if (sourceChecksum !== tempChecksum) {
      fs.unlinkSync(tempPath);
      throw new Error('Backup verification failed: checksum mismatch');
    }
    
    // Atomic rename
    fs.renameSync(tempPath, targetPath);
    
    const stats = fs.statSync(targetPath);
    
    return {
      path: targetPath,
      checksum: tempChecksum,
      size: stats.size,
    };
  }

  /**
   * Restore from a specific backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} not found`);
    }

    // Load backup info
    const infoPath = path.join(backupPath, 'backup-info.json');
    if (!fs.existsSync(infoPath)) {
      throw new Error(`Backup info not found for ${backupId}`);
    }

    const backupInfo: BackupInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

    // Verify backup integrity
    await this.verifyBackup(backupId);

    // Create a backup of current state before restoring (safety measure)
    await this.createBackup();

    // Restore global storage
    if (backupInfo.globalStorageBackedUp) {
      const sourcePath = path.join(backupPath, 'globalStorage.vscdb');
      const targetPath = this.reader.getDbPath();
      
      if (fs.existsSync(sourcePath)) {
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // Atomic restore
        const tempPath = `${targetPath}.tmp`;
        fs.copyFileSync(sourcePath, tempPath);
        fs.renameSync(tempPath, targetPath);
      }
    }

    // Restore workspace storage
    if (backupInfo.workspaceStorageBackedUp) {
      const sourcePath = path.join(backupPath, 'workspaceStorage.vscdb');
      const workspaceStoragePath = this.reader.getWorkspaceStoragePath();
      
      if (workspaceStoragePath && fs.existsSync(sourcePath)) {
        const targetDir = path.dirname(workspaceStoragePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const tempPath = `${workspaceStoragePath}.tmp`;
        fs.copyFileSync(sourcePath, tempPath);
        fs.renameSync(tempPath, workspaceStoragePath);
      }
    }

    // Restore workspace .cursor directory
    if (backupInfo.workspaceCursorBackedUp) {
      const sourcePath = path.join(backupPath, 'workspaceCursor.vscdb');
      const workspaceCursorPath = this.reader.getWorkspaceCursorPath();
      
      if (workspaceCursorPath && fs.existsSync(sourcePath)) {
        const targetDir = path.dirname(workspaceCursorPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const tempPath = `${workspaceCursorPath}.tmp`;
        fs.copyFileSync(sourcePath, tempPath);
        fs.renameSync(tempPath, workspaceCursorPath);
      } else if (backupInfo.workspacePath && fs.existsSync(sourcePath)) {
        // Workspace path might have changed, try to restore to original location
        const originalPath = path.join(backupInfo.workspacePath, '.cursor', 'state.vscdb');
        const targetDir = path.dirname(originalPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const tempPath = `${originalPath}.tmp`;
        fs.copyFileSync(sourcePath, tempPath);
        fs.renameSync(tempPath, originalPath);
      }
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const backupPath = path.join(this.backupDir, backupId);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const metadataPath = path.join(backupPath, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Backup metadata not found for ${backupId}`);
    }

    const metadata: BackupMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Verify all source files
    for (const [sourceName, sourceInfo] of Object.entries(metadata.sources)) {
      if (!sourceInfo) continue;
      
      const sourcePath = path.join(backupPath, `${sourceName}.vscdb`);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Backup file missing: ${sourceName}.vscdb`);
      }

      const currentChecksum = this.calculateFileChecksum(sourcePath);
      if (currentChecksum !== sourceInfo.checksum) {
        throw new Error(`Backup file corrupted: ${sourceName}.vscdb (checksum mismatch)`);
      }
    }

    return true;
  }

  /**
   * List all available backups
   */
  listBackups(): BackupInfo[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const backups: BackupInfo[] = [];
    const entries = fs.readdirSync(this.backupDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const infoPath = path.join(this.backupDir, entry.name, 'backup-info.json');
        if (fs.existsSync(infoPath)) {
          try {
            const info: BackupInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            // Convert timestamp string back to Date
            info.timestamp = new Date(info.timestamp);
            backups.push(info);
          } catch (error) {
            console.warn(`Failed to read backup info for ${entry.name}: ${error}`);
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backups;
  }

  /**
   * Get the latest backup
   */
  getLatestBackup(): BackupInfo | null {
    const backups = this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Cleanup old backups, keeping only the most recent N backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = this.listBackups();

    if (backups.length <= this.maxBackups) {
      return;
    }

    // Delete oldest backups
    const toDelete = backups.slice(this.maxBackups);
    
    for (const backup of toDelete) {
      try {
        fs.rmSync(backup.backupPath, { recursive: true, force: true });
        console.log(`Deleted old backup: ${backup.id}`);
      } catch (error: any) {
        console.warn(`Failed to delete backup ${backup.id}: ${error.message}`);
      }
    }
  }

  /**
   * Delete a specific backup
   */
  deleteBackup(backupId: string): void {
    const backupPath = path.join(this.backupDir, backupId);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup ${backupId} not found`);
    }

    fs.rmSync(backupPath, { recursive: true, force: true });
  }

  /**
   * Get total backup size
   */
  getTotalBackupSize(): number {
    const backups = this.listBackups();
    return backups.reduce((sum, backup) => sum + backup.size, 0);
  }

  /**
   * Generate a unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Calculate checksum of a file
   */
  private calculateFileChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Calculate checksum of a string
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Set maximum number of backups to keep
   */
  setMaxBackups(maxBackups: number): void {
    this.maxBackups = Math.max(1, Math.min(100, maxBackups)); // Clamp between 1 and 100
  }

  /**
   * Get backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }
}
