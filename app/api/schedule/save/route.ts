// API endpoint for saving finalized dispatch schedules to Google Sheets
// POST /api/schedule/save

import { NextRequest, NextResponse } from 'next/server';
import { writeScheduleToSheets, checkSheetsConnection, type ScheduleData } from '@/lib/google-sheets';

/**
 * GET /api/schedule/save - Health check
 */
export async function GET() {
  try {
    const status = await checkSheetsConnection();

    return NextResponse.json({
      status: status.connected ? 'connected' : 'error',
      ...status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedule/save - Save schedule data to Google Sheets
 *
 * Request body:
 * {
 *   timestamp: string;           // ISO timestamp
 *   originalAppointment: string; // e.g., "14:00"
 *   confirmedTime: string;       // e.g., "15:30"
 *   confirmedDock: string;       // e.g., "B5"
 *   delayMinutes: number;
 *   shipmentValue: number;
 *   totalCost: number;
 *   warehouseContact?: string;
 *   partyName?: string;
 *   contractFileName?: string;
 *   status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
 * }
 *
 * Response:
 * {
 *   success: true,
 *   spreadsheetUrl: "https://docs.google.com/spreadsheets/d/...",
 *   rowNumber: 5,
 *   message: "Schedule saved successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'timestamp',
      'originalAppointment',
      'confirmedTime',
      'confirmedDock',
      'delayMinutes',
      'shipmentValue',
      'totalCost',
      'status',
    ];

    const missingFields = requiredFields.filter((field) => !(field in body));

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['CONFIRMED', 'TENTATIVE', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Prepare schedule data
    const scheduleData: ScheduleData = {
      timestamp: body.timestamp,
      originalAppointment: body.originalAppointment,
      confirmedTime: body.confirmedTime,
      confirmedDock: body.confirmedDock,
      delayMinutes: Number(body.delayMinutes),
      shipmentValue: Number(body.shipmentValue),
      totalCost: Number(body.totalCost),
      warehouseContact: body.warehouseContact,
      partyName: body.partyName,
      contractFileName: body.contractFileName,
      status: body.status,
    };

    console.log('💾 Saving schedule to Google Sheets:', {
      time: scheduleData.confirmedTime,
      dock: scheduleData.confirmedDock,
      cost: scheduleData.totalCost,
    });

    // Write to Google Sheets
    const result = await writeScheduleToSheets(scheduleData);

    if (!result.success) {
      console.error('❌ Failed to save schedule to Google Sheets');
      console.error('   Error:', result.error);
      console.error('   Debug info:', result.debug);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          debug: result.debug,
        },
        { status: 500 }
      );
    }

    console.log('✅ Schedule saved successfully:', {
      spreadsheetUrl: result.spreadsheetUrl,
      rowNumber: result.rowNumber,
    });

    return NextResponse.json({
      success: true,
      spreadsheetUrl: result.spreadsheetUrl,
      spreadsheetId: result.spreadsheetId,
      sheetName: result.sheetName,
      rowNumber: result.rowNumber,
      message: `Schedule saved successfully to row ${result.rowNumber}`,
      debug: result.debug,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error saving schedule:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to save schedule: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
