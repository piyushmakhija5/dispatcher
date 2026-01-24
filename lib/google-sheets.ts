// Google Sheets service for writing finalized dispatch schedules
// Server-side only - do not import in client components

import { google, sheets_v4 } from 'googleapis';

// Lazy initialization to avoid issues during build
let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Get authenticated Google Sheets client using service account
 */
function getClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !privateKey) {
      throw new Error(
        'Google Sheets credentials not configured. ' +
        'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.'
      );
    }

    // Handle escaped newlines in private key (common in env vars)
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

/**
 * Schedule data to be written to Google Sheets
 */
export interface ScheduleData {
  timestamp: string;
  originalAppointment: string;
  confirmedTime: string;
  confirmedDock: string;
  delayMinutes: number;
  shipmentValue: number;
  totalCost: number;
  warehouseContact?: string;
  partyName?: string;
  contractFileName?: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

/**
 * Result of writing schedule to Google Sheets
 */
export interface WriteScheduleResult {
  success: boolean;
  spreadsheetId?: string;
  sheetName?: string;
  rowNumber?: number;
  spreadsheetUrl?: string;
  error?: string;
  debug?: {
    folderId?: string;
    spreadsheetName?: string;
    valuesWritten?: number;
  };
}

/**
 * Find or create a spreadsheet in the Google Drive folder
 *
 * @param folderId - Google Drive folder ID
 * @param spreadsheetName - Name of the spreadsheet to find/create
 * @returns Spreadsheet ID
 */
async function findOrCreateSpreadsheet(
  folderId: string,
  spreadsheetName: string
): Promise<string> {
  const sheets = getClient();

  // Search for existing spreadsheet in the folder
  const drive = google.drive({
    version: 'v3',
    auth: sheets.context._options.auth as any
  });

  const searchResult = await drive.files.list({
    q: `'${folderId}' in parents and name='${spreadsheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  if (searchResult.data.files && searchResult.data.files.length > 0) {
    // Found existing spreadsheet
    return searchResult.data.files[0].id!;
  }

  // Create new spreadsheet directly in the folder using Drive API
  // This avoids permission issues with moving files between folders
  const driveCreateResult = await drive.files.create({
    requestBody: {
      name: spreadsheetName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId], // Create directly in the target folder
    },
    fields: 'id',
  });

  const spreadsheetId = driveCreateResult.data.id!;

  // Note: File created by service account will use service account's quota
  // To avoid quota issues, manually create the spreadsheet in your Drive
  // and share it with the service account (see README for instructions)

  // Now format the spreadsheet with headers using Sheets API
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Rename the default sheet
        {
          updateSheetProperties: {
            properties: {
              sheetId: 0,
              title: 'Schedule',
              gridProperties: {
                frozenRowCount: 1, // Freeze header row
              },
            },
            fields: 'title,gridProperties.frozenRowCount',
          },
        },
        // Add header row
        {
          updateCells: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'Timestamp' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Original Appointment' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Confirmed Time' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Confirmed Dock' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Delay (minutes)' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Shipment Value ($)' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Total Cost ($)' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Warehouse Contact' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Party Name' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Contract File' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Status' }, userEnteredFormat: { textFormat: { bold: true } } },
                ],
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
          },
        },
      ],
    },
  });

  return spreadsheetId;
}

/**
 * Write schedule data to Google Sheets
 * Appends a new row with the finalized schedule details
 *
 * @param data - Schedule data to write
 * @param options - Optional spreadsheet name and folder ID
 * @returns Result with spreadsheet URL and row number
 */
export async function writeScheduleToSheets(
  data: ScheduleData,
  options?: {
    spreadsheetName?: string;
    folderId?: string;
    spreadsheetId?: string;
  }
): Promise<WriteScheduleResult> {
  // Prefer explicit spreadsheet ID from options or env var
  const explicitSpreadsheetId = options?.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  const spreadsheetName = options?.spreadsheetName || process.env.GOOGLE_SHEETS_SCHEDULE_NAME || 'Dispatcher Schedule';
  const folderId = options?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!explicitSpreadsheetId && !folderId) {
    return {
      success: false,
      error: 'Neither spreadsheet ID nor folder ID provided. Set GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_DRIVE_FOLDER_ID environment variable.',
    };
  }

  try {
    const sheets = getClient();

    // Use explicit spreadsheet ID if provided, otherwise find/create by name
    let spreadsheetId: string;

    if (explicitSpreadsheetId) {
      console.log(`📊 Using explicit spreadsheet ID: ${explicitSpreadsheetId}`);
      spreadsheetId = explicitSpreadsheetId;
    } else {
      console.log(`🔍 Searching for spreadsheet by name: ${spreadsheetName}`);
      spreadsheetId = await findOrCreateSpreadsheet(folderId!, spreadsheetName);
    }

    // Prepare row data
    const rowData = [
      data.timestamp,
      data.originalAppointment,
      data.confirmedTime,
      data.confirmedDock,
      data.delayMinutes,
      data.shipmentValue,
      data.totalCost,
      data.warehouseContact || '',
      data.partyName || '',
      data.contractFileName || '',
      data.status,
    ];

    // Append the row - use Sheet1 as default tab name for manually created sheets
    // Try 'Schedule' first (for auto-created sheets), fall back to 'Sheet1' (for manual sheets)
    let appendResult;
    try {
      appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Schedule!A:K',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    } catch (error) {
      // If 'Schedule' sheet doesn't exist, try 'Sheet1' (default for manually created spreadsheets)
      console.log('⚠️ "Schedule" sheet not found, trying "Sheet1"...');
      appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:K',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    }

    // Get the row number that was written
    const updatedRange = appendResult.data.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/\d+$/);
    const rowNumber = rowMatch ? parseInt(rowMatch[0]) : undefined;

    // Generate spreadsheet URL
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return {
      success: true,
      spreadsheetId,
      sheetName: 'Schedule',
      rowNumber,
      spreadsheetUrl,
      debug: {
        folderId,
        spreadsheetName,
        valuesWritten: rowData.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to write schedule: ${errorMessage}`,
      debug: { folderId },
    };
  }
}

/**
 * Check if Google Sheets connection is working
 *
 * @returns Connection status
 */
export async function checkSheetsConnection(): Promise<{
  connected: boolean;
  folderConfigured: boolean;
  folderId?: string;
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
    // Try to access the service
    const sheets = getClient();

    // Test by attempting to find/create a test spreadsheet (won't actually create)
    // Just verify the auth works
    const drive = google.drive({
      version: 'v3',
      auth: sheets.context._options.auth as any
    });

    await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
      pageSize: 1,
    });

    return {
      connected: true,
      folderConfigured: true,
      folderId,
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
