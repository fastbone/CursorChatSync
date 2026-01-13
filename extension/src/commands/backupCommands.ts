import * as vscode from 'vscode';
import { BackupService } from '../sync/backupService';
import { DbWriter } from '../sync/dbWriter';

export function registerBackupCommands(
  context: vscode.ExtensionContext,
  dbWriter: DbWriter
) {
  const backupService = dbWriter.getBackupService();

  // List backups command
  const listBackupsCommand = vscode.commands.registerCommand(
    'cursorChatSync.listBackups',
    async () => {
      try {
        const backups = backupService.listBackups();
        
        if (backups.length === 0) {
          vscode.window.showInformationMessage('No backups found');
          return;
        }

        // Show backup list
        const items = backups.map(backup => ({
          label: `Backup ${backup.id.substring(0, 20)}...`,
          description: `${backup.timestamp.toLocaleString()} - ${(backup.size / 1024).toFixed(2)} KB`,
          detail: `Global: ${backup.globalStorageBackedUp ? '✓' : '✗'} | Workspace: ${backup.workspaceStorageBackedUp ? '✓' : '✗'} | .cursor: ${backup.workspaceCursorBackedUp ? '✓' : '✗'}`,
          backup,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a backup to view details or restore',
        });

        if (!selected) {
          return;
        }

        // Show backup details
        const backup = selected.backup;
        const details = [
          `Backup ID: ${backup.id}`,
          `Created: ${backup.timestamp.toLocaleString()}`,
          `Size: ${(backup.size / 1024).toFixed(2)} KB`,
          `Workspace: ${backup.workspacePath || 'N/A'}`,
          `Global Storage: ${backup.globalStorageBackedUp ? 'Backed up' : 'Not backed up'}`,
          `Workspace Storage: ${backup.workspaceStorageBackedUp ? 'Backed up' : 'Not backed up'}`,
          `Workspace .cursor: ${backup.workspaceCursorBackedUp ? 'Backed up' : 'Not backed up'}`,
        ].join('\n');

        const action = await vscode.window.showInformationMessage(
          details,
          'Restore',
          'Delete',
          'Cancel'
        );

        if (action === 'Restore') {
          // Call restore command handler
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to restore backup ${backup.id.substring(0, 20)}...? This will overwrite your current chat history.`,
            { modal: true },
            'Yes, Restore',
            'Cancel'
          );

          if (confirm === 'Yes, Restore') {
            try {
              await backupService.verifyBackup(backup.id);
              await backupService.restoreBackup(backup.id);
              vscode.window.showInformationMessage('Chat history restored successfully. Please restart Cursor to see changes.');
            } catch (error: any) {
              vscode.window.showErrorMessage(`Failed to restore backup: ${error.message}`);
            }
          }
        } else if (action === 'Delete') {
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete backup ${backup.id.substring(0, 20)}...?`,
            { modal: true },
            'Yes, Delete',
            'Cancel'
          );

          if (confirm === 'Yes, Delete') {
            try {
              backupService.deleteBackup(backup.id);
              vscode.window.showInformationMessage('Backup deleted successfully');
            } catch (error: any) {
              vscode.window.showErrorMessage(`Failed to delete backup: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to list backups: ${error.message}`);
      }
    }
  );

  // Restore backup command
  const restoreBackupCommand = vscode.commands.registerCommand(
    'cursorChatSync.restoreBackup',
    async () => {
      try {
        // Let user select backup
        const backups = backupService.listBackups();
        if (backups.length === 0) {
          vscode.window.showInformationMessage('No backups found');
          return;
        }

        const items = backups.map(backup => ({
          label: backup.id.substring(0, 30),
          description: backup.timestamp.toLocaleString(),
          backup,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a backup to restore',
        });

        if (!selected) {
          return;
        }

        const backupId = selected.backup.id;

        // Confirm restore
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to restore backup ${backupId.substring(0, 20)}...? This will overwrite your current chat history.`,
          { modal: true },
          'Yes, Restore',
          'Cancel'
        );

        if (confirm !== 'Yes, Restore') {
          return;
        }

        // Verify backup before restore
        await backupService.verifyBackup(backupId);

        // Restore
        await backupService.restoreBackup(backupId);

        vscode.window.showInformationMessage('Chat history restored successfully. Please restart Cursor to see changes.');
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to restore backup: ${error.message}`);
      }
    }
  );

  // Create manual backup command
  const createBackupCommand = vscode.commands.registerCommand(
    'cursorChatSync.createBackup',
    async () => {
      try {
        vscode.window.showInformationMessage('Creating backup...');
        const backup = await backupService.createBackup();
        vscode.window.showInformationMessage(
          `Backup created successfully: ${backup.id.substring(0, 20)}... (${(backup.size / 1024).toFixed(2)} KB)`
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to create backup: ${error.message}`);
      }
    }
  );

  // Delete backup command
  const deleteBackupCommand = vscode.commands.registerCommand(
    'cursorChatSync.deleteBackup',
    async () => {
      try {
        const backups = backupService.listBackups();
        if (backups.length === 0) {
          vscode.window.showInformationMessage('No backups found');
          return;
        }

        const items = backups.map(backup => ({
          label: backup.id.substring(0, 30),
          description: backup.timestamp.toLocaleString(),
          backup,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a backup to delete',
        });

        if (!selected) {
          return;
        }

        const backupId = selected.backup.id;

        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete backup ${backupId.substring(0, 20)}...?`,
          { modal: true },
          'Yes, Delete',
          'Cancel'
        );

        if (confirm !== 'Yes, Delete') {
          return;
        }

        backupService.deleteBackup(backupId);
        vscode.window.showInformationMessage('Backup deleted successfully');
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to delete backup: ${error.message}`);
      }
    }
  );

  // Show backup info command
  const showBackupInfoCommand = vscode.commands.registerCommand(
    'cursorChatSync.showBackupInfo',
    async () => {
      try {
        const backups = backupService.listBackups();
        const totalSize = backupService.getTotalBackupSize();
        const backupDir = backupService.getBackupDir();

        const info = [
          `Total Backups: ${backups.length}`,
          `Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
          `Backup Directory: ${backupDir}`,
          '',
          'Recent Backups:',
          ...backups.slice(0, 5).map(backup => 
            `  • ${backup.timestamp.toLocaleString()} - ${(backup.size / 1024).toFixed(2)} KB`
          ),
        ].join('\n');

        vscode.window.showInformationMessage(info);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get backup info: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(
    listBackupsCommand,
    restoreBackupCommand,
    createBackupCommand,
    deleteBackupCommand,
    showBackupInfoCommand
  );
}
