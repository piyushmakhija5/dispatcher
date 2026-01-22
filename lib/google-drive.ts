// Google Drive service for fetching contract documents
// Server-side only - do not import in client components

import { google, drive_v3 } from 'googleapis';

// Lazy initialization to avoid issues during build
let driveClient: drive_v3.Drive | null = null;

/**
 * Get authenticated Google Drive client using service account
 */
function getClient(): drive_v3.Drive {
  if (!driveClient) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!email || !privateKey) {
      throw new Error(
        'Google Drive credentials not configured. ' +
        'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.'
      );
    }

    // Handle escaped newlines in private key (common in env vars)
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    driveClient = google.drive({ version: 'v3', auth });
  }
  return driveClient;
}

/** File metadata from Google Drive */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

/** Result of fetching a contract */
export interface FetchContractResult {
  success: boolean;
  file?: DriveFile;
  contentType?: 'pdf' | 'text';
  content?: string;
  error?: string;
  debug?: {
    folderId: string;
    filesFound: number;
    selectedFile?: string;
    mimeType?: string;
    contentLength?: number;
  };
}

/**
 * List files in a Google Drive folder, sorted by modified time (newest first)
 * 
 * @param folderId - Google Drive folder ID
 * @returns Array of file metadata
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getClient();
  
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  const files = response.data.files || [];
  
  return files.map((file) => ({
    id: file.id || '',
    name: file.name || '',
    mimeType: file.mimeType || '',
    modifiedTime: file.modifiedTime || '',
  }));
}

/**
 * Get file content from Google Drive
 * - PDFs are returned as base64 (Claude can process directly)
 * - Google Docs are exported as plain text
 * - Plain text files are returned as-is
 * 
 * @param fileId - Google Drive file ID
 * @param mimeType - MIME type of the file
 * @returns Object with contentType and content
 */
export async function getFileContent(
  fileId: string,
  mimeType: string
): Promise<{ contentType: 'pdf' | 'text'; content: string }> {
  const drive = getClient();

  // Handle different file types
  if (mimeType === 'application/pdf') {
    // Download PDF as binary and return as base64
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return {
      contentType: 'pdf',
      content: buffer.toString('base64'),
    };
  }
  
  if (mimeType === 'application/vnd.google-apps.document') {
    // Export Google Doc as plain text
    const response = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'text' }
    );
    
    return {
      contentType: 'text',
      content: response.data as string,
    };
  }
  
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    // Download plain text files directly
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    
    return {
      contentType: 'text',
      content: response.data as string,
    };
  }

  throw new Error(
    `Unsupported file type: ${mimeType}. ` +
    'Supported types: PDF, Google Docs, plain text files.'
  );
}

/**
 * Fetch the most recently modified contract from Google Drive folder
 * 
 * @param folderId - Optional folder ID (defaults to GOOGLE_DRIVE_FOLDER_ID env var)
 * @returns Contract content and metadata
 */
export async function fetchMostRecentContract(
  folderId?: string
): Promise<FetchContractResult> {
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!targetFolderId) {
    return {
      success: false,
      error: 'No folder ID provided. Set GOOGLE_DRIVE_FOLDER_ID environment variable.',
      debug: { folderId: '', filesFound: 0 },
    };
  }

  try {
    // List files in folder (already sorted by modifiedTime desc)
    const files = await listFilesInFolder(targetFolderId);
    
    if (files.length === 0) {
      return {
        success: false,
        error: 'No files found in the specified folder.',
        debug: { folderId: targetFolderId, filesFound: 0 },
      };
    }

    // Get the most recent file (first in list)
    const mostRecent = files[0];
    
    // Fetch the file content
    const { contentType, content } = await getFileContent(
      mostRecent.id,
      mostRecent.mimeType
    );

    return {
      success: true,
      file: mostRecent,
      contentType,
      content,
      debug: {
        folderId: targetFolderId,
        filesFound: files.length,
        selectedFile: mostRecent.name,
        mimeType: mostRecent.mimeType,
        contentLength: content.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to fetch contract: ${errorMessage}`,
      debug: { folderId: targetFolderId, filesFound: 0 },
    };
  }
}

/**
 * Check if Google Drive connection is working
 * 
 * @returns Connection status and folder info
 */
export async function checkDriveConnection(): Promise<{
  connected: boolean;
  folderConfigured: boolean;
  folderId?: string;
  fileCount?: number;
  error?: string;
}> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!folderId) {
    return {
      connected: false,
      folderConfigured: false,
      error: 'GOOGLE_DRIVE_FOLDER_ID not configured',
    };
  }

  try {
    const files = await listFilesInFolder(folderId);
    return {
      connected: true,
      folderConfigured: true,
      folderId,
      fileCount: files.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      connected: false,
      folderConfigured: true,
      folderId,
      error: errorMessage,
    };
  }
}
