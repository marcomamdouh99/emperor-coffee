import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ESCPOSEncoder } from '@/lib/escpos-encoder';

/**
 * GET /api/transfers/[id]/po-invoice
 * Generate ESC/POS formatted invoice for thermal printing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log('[PO Invoice] Generating invoice for transfer:', id);

    // Fetch transfer with all related data
    const transfer = await db.inventoryTransfer.findUnique({
      where: { id },
      include: {
        sourceBranch: true,
        targetBranch: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!transfer) {
      console.log('[PO Invoice] Transfer not found:', id);
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    if (!transfer.isPurchaseOrder) {
      console.log('[PO Invoice] Not a purchase order:', id);
      return NextResponse.json(
        { error: 'This is not a purchase order' },
        { status: 400 }
      );
    }

    console.log('[PO Invoice] PO found:', {
      poNumber: transfer.poNumber,
      transferNumber: transfer.transferNumber,
      branch: transfer.targetBranch.branchName,
      itemCount: transfer.items.length,
    });

    // Generate ESC/POS invoice
    const encoder = new ESCPOSEncoder();

    // Reset printer
    encoder.reset();

    // Center align for header
    encoder.align('center');

    // Title - PURCHASE ORDER (Bold, Large)
    encoder.style({ bold: true, doubleWidth: true, doubleHeight: true })
      .text('PURCHASE ORDER')
      .newLines(2)
      .style({ bold: false, doubleWidth: false, doubleHeight: false });

    // PO Number and Transfer Number
    encoder.fontSize('double')
      .text(`PO Number: ${transfer.poNumber || 'N/A'}`)
      .newLine()
      .text(`Transfer #: ${transfer.transferNumber}`)
      .newLines(2)
      .fontSize('normal');

    // Branch information (Left aligned)
    encoder.align('left')
      .text('Branch Details:')
      .newLine()
      .text(`  Branch: ${transfer.targetBranch.branchName}`)
      .newLine()
      .text(`  Date: ${new Date(transfer.requestedAt).toLocaleDateString()}`)
      .newLines(2);

    // Source branch if available
    if (transfer.sourceBranch) {
      encoder.text(`Source: ${transfer.sourceBranch.branchName}`)
        .newLines(2);
    } else {
      encoder.text(`Source: Headquarters`)
        .newLines(2);
    }

    // Items header
    encoder.align('center').style({ bold: true })
      .hr('=')
      .text('ITEMS')
      .hr('=')
      .style({ bold: false })
      .align('left')
      .newLine();

    // Column headers
    encoder.text('Item                    Qty    Unit    Unit Price   Total')
      .newLine()
      .hr('-');

    // Items
    let subtotal = 0;
    transfer.items.forEach((item) => {
      const itemName = item.ingredient?.name || item.ingredientId || 'Unknown';
      const quantity = item.quantity;
      const unit = item.unit || 'unit';
      const unitPrice = item.unitPrice || item.ingredient?.costPerUnit || 0;
      const itemTotal = item.totalPrice || (quantity * unitPrice);

      subtotal += itemTotal;

      // Format each row with fixed-width columns
      const name = itemName.padEnd(24, ' ').substring(0, 24);
      const qty = quantity.toString().padStart(6, ' ');
      const u = unit.padStart(6, ' ');
      const price = `$${unitPrice.toFixed(2)}`.padStart(12, ' ');
      const total = `$${itemTotal.toFixed(2)}`.padStart(8, ' ');

      encoder.text(`${name}${qty}${u}${price}${total}`)
        .newLine();
    });

    // Total section
    encoder.hr('=')
      .newLines(2)
      .style({ bold: true })
      .text(`Subtotal:           $${subtotal.toFixed(2)}`)
      .newLine()
      .text(`TOTAL:              $${(transfer.totalPrice || subtotal).toFixed(2)}`)
      .newLine()
      .style({ bold: false })
      .newLines(2);

    // Notes if any
    if (transfer.notes) {
      encoder.align('left')
        .text('Notes:')
        .newLine()
        .text(transfer.notes)
        .newLines(2);
    }

    // Footer
    encoder.align('center')
      .hr('=')
      .newLines(1)
      .text('Thank you for your order!')
      .newLines(3);

    // Cut paper
    encoder.cut('full');

    console.log('[PO Invoice] Generated invoice, size:', encoder.length);

    // Return as base64
    const escposData = encoder.encode();
    const base64Data = Buffer.from(escposData).toString('base64');

    return NextResponse.json({
      success: true,
      transfer,
      escposData: base64Data,
      size: escposData.length,
    });

  } catch (error) {
    console.error('[PO Invoice] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
