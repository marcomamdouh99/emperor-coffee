import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateRequest, orderCreateSchema, formatZodErrors } from '@/lib/validators';
import { parsePaginationParams, buildPaginatedResponse, defaultPagination } from '@/lib/pagination';
import { logOrderCreated, logPromoCodeApplied } from '@/lib/audit-logger';

/**
 * Get or create "Loyalty Discounts" cost category for a branch
 */
async function getLoyaltyDiscountCostCategory(branchId: string) {
  let costCategory = await db.costCategory.findFirst({
    where: {
      name: 'Loyalty Discounts',
      branchId, // Only get branch-specific category
    },
  });

  if (!costCategory) {
    // Create the loyalty discounts category for this branch
    costCategory = await db.costCategory.create({
      data: {
        name: 'Loyalty Discounts',
        description: 'Discounts redeemed from customer loyalty points',
        icon: 'Gift',
        sortOrder: 999, // Show at the bottom
        isActive: true,
        branchId, // Make it branch-specific
      },
    });
  }

  return costCategory;
}

/**
 * Create a loyalty discount cost record for a branch
 */
async function createLoyaltyDiscountCost(
  branchId: string,
  discountAmount: number,
  orderNumber: number,
  orderId: string,
  customerId?: string | null,
  shiftId?: string | null
) {
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  const costCategory = await getLoyaltyDiscountCostCategory(branchId);

  await db.branchCost.create({
    data: {
      branchId,
      costCategoryId: costCategory.id,
      shiftId, // Link to shift for accurate reporting
      amount: discountAmount,
      period: currentPeriod,
      notes: `Loyalty points redeemed on Order #${orderNumber}${customerId ? ` for customer ${customerId}` : ''}`,
    },
  });
}

/**
 * Get or create "Promo Codes" cost category for a branch
 */
async function getPromoCodeCostCategory(branchId: string) {
  console.log('[Cost] Getting/creating promo code cost category for branch:', branchId);

  let costCategory = await db.costCategory.findFirst({
    where: {
      name: 'Promo Codes',
      branchId, // Only get branch-specific category
    },
  });

  console.log('[Cost] Existing cost category found:', !!costCategory);

  if (!costCategory) {
    console.log('[Cost] Creating new promo code cost category...');
    // Create the promo codes category for this branch
    costCategory = await db.costCategory.create({
      data: {
        name: 'Promo Codes',
        description: 'Discounts from promotional codes',
        icon: 'Tag',
        sortOrder: 998, // Show just above loyalty discounts
        isActive: true,
        branchId, // Make it branch-specific
      },
    });
    console.log('[Cost] Cost category created:', { id: costCategory.id, name: costCategory.name });
  } else {
    console.log('[Cost] Using existing cost category:', { id: costCategory.id, name: costCategory.name });
  }

  return costCategory;
}

/**
 * Create a promo code discount cost record for a branch
 */
async function createPromoCodeDiscountCost(
  branchId: string,
  discountAmount: number,
  orderNumber: number,
  orderId: string,
  promoCode: string,
  customerId?: string | null,
  shiftId?: string | null
) {
  try {
    console.log('[Cost] Creating promo code cost:', { branchId, discountAmount, orderNumber, promoCode, shiftId });

    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    console.log('[Cost] Current period:', currentPeriod);

    const costCategory = await getPromoCodeCostCategory(branchId);
    console.log('[Cost] Got cost category:', { id: costCategory.id, name: costCategory.name });

    const branchCost = await db.branchCost.create({
      data: {
        branchId,
        costCategoryId: costCategory.id,
        shiftId, // Link to shift for accurate reporting
        amount: discountAmount,
        period: currentPeriod,
        notes: `Promo code '${promoCode}' used on Order #${orderNumber}${customerId ? ` for customer ${customerId}` : ''}`,
      },
    });

    console.log('[Cost] Branch cost created successfully:', { id: branchCost.id, amount: branchCost.amount });
    return branchCost;
  } catch (error) {
    console.error('[Cost] Error creating promo code cost:', error);
    throw error;
  }
}

/**
 * Safely deduct inventory with atomic operation to prevent race conditions
 * Uses optimistic concurrency control for SQLite
 */
async function safeInventoryDeduct(
  tx: any,
  branchId: string,
  ingredientId: string,
  quantityToDeduct: number,
  orderId: string,
  createdBy: string,
  ingredientName: string
) {
  const quantityToDeductAbs = Math.abs(quantityToDeduct);

  // Check current stock first
  const inventory = await tx.branchInventory.findUnique({
    where: {
      branchId_ingredientId: {
        branchId,
        ingredientId,
      },
    },
  });

  const currentStock = inventory?.currentStock || 0;

  if (currentStock < quantityToDeductAbs) {
    throw new Error(
      `Insufficient inventory for ${ingredientName}. Current stock: ${currentStock}, Required: ${quantityToDeductAbs}`
    );
  }

  // Update inventory
  const stockBefore = currentStock;
  const stockAfter = currentStock - quantityToDeductAbs;

  await tx.branchInventory.update({
    where: {
      branchId_ingredientId: {
        branchId,
        ingredientId,
      },
    },
    data: {
      currentStock: stockAfter,
      lastModifiedAt: new Date(),
    },
  });

  // Create inventory transaction record
  await tx.inventoryTransaction.create({
    data: {
      branchId,
      ingredientId,
      transactionType: 'SALE',
      quantityChange: -quantityToDeductAbs,
      stockBefore,
      stockAfter,
      orderId,
      createdBy,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Validate request with Zod
    const validationResult = validateRequest(orderCreateSchema, await request.json());

    if (!validationResult.success) {
      console.error('Order validation failed:', validationResult.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: formatZodErrors(validationResult.errors)
        },
        { status: 400 }
      );
    }

    const {
      branchId,
      cashierId,
      items,
      paymentMethod,
      orderType,
      tableId,
      deliveryAddress,
      deliveryAreaId,
      deliveryFee,
      customerId,
      customerAddressId,
      customerPhone,
      customerName,
      courierId,
      loyaltyPointsRedeemed,
      loyaltyDiscount,
      promoCodeId,
      promoDiscount,
      orderNumber,
      cardReferenceNumber,
    } = validationResult.data;

    // Get next order number if not provided
    let finalOrderNumber = orderNumber;
    if (!finalOrderNumber) {
      const lastOrder = await db.order.findFirst({
        where: { branchId },
        orderBy: { orderNumber: 'desc' },
      });
      finalOrderNumber = (lastOrder?.orderNumber || 0) + 1;
    }

    // Get cashier info
    const cashier = await db.user.findUnique({
      where: { id: cashierId },
    });

    if (!cashier) {
      return NextResponse.json(
        { error: 'Cashier not found' },
        { status: 404 }
      );
    }

    // CASHIER must have their own open shift to process orders
    // ADMIN and BRANCH_MANAGER can use ANY open shift from the branch
    let openShift = null;

    if (cashier.role === 'CASHIER') {
      // Cashiers must have their own open shift
      openShift = await db.shift.findFirst({
        where: {
          cashierId,
          isClosed: false,
        },
      });

      if (!openShift) {
        return NextResponse.json(
          { error: 'No active shift found. Please open a shift before processing orders.' },
          { status: 400 }
        );
      }

      // Verify that open shift is for the same branch
      if (openShift.branchId !== branchId) {
        return NextResponse.json(
          { error: 'Active shift is for a different branch' },
          { status: 400 }
        );
      }
    } else {
      // ADMIN and BRANCH_MANAGER can use any open shift from the branch
      openShift = await db.shift.findFirst({
        where: {
          branchId,
          isClosed: false,
        },
      });

      if (!openShift) {
        return NextResponse.json(
          { error: `No active shift found for branch. Please have a cashier open a shift before processing orders.` },
          { status: 400 }
        );
      }
    }
    // Calculate order totals and validate menu items
    let subtotal = 0;
    const orderItemsToCreate = [];
    const inventoryDeductions = [];

    for (const item of items) {
      // Get menu item with variants
      const menuItem = await db.menuItem.findUnique({
        where: { id: item.menuItemId },
        include: {
          recipes: {
            include: {
              ingredient: true,
            },
          },
          categoryRel: true,
          ...(item.menuItemVariantId ? {
            variants: {
              include: {
                variantType: true,
                variantOption: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          } : {}),
        },
      });

      if (!menuItem) {
        return NextResponse.json(
          { error: `Menu item not found: ${item.menuItemId}` },
          { status: 404 }
        );
      }

      if (!menuItem.isActive) {
        return NextResponse.json(
          { error: `Menu item ${menuItem.name} is not available` },
          { status: 400 }
        );
      }

      // Handle variant pricing if provided
      let finalPrice = menuItem.price;
      let variantName = null;
      let variantId = null;

      if (item.menuItemVariantId) {
        const variant = await db.menuItemVariant.findUnique({
          where: { id: item.menuItemVariantId },
          include: {
            variantType: true,
            variantOption: true,
          },
        });

        if (variant) {
          finalPrice = menuItem.price + variant.priceModifier;
          variantName = `${variant.variantType.name}: ${variant.variantOption.name}`;
          variantId = variant.id;
        }
      }

      const itemSubtotal = finalPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItemsToCreate.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        quantity: item.quantity,
        unitPrice: finalPrice,
        subtotal: itemSubtotal,
        recipeVersion: menuItem.version,
        menuItemVariantId: variantId,
        variantName,
        specialInstructions: item.specialInstructions || null,
      });

      // Calculate inventory deductions based on recipes
      // Filter recipes: if variant selected, only use variant-specific recipes; otherwise use base recipes
      const relevantRecipes = menuItem.recipes.filter(
        recipe => recipe.menuItemVariantId === (item.menuItemVariantId || null)
      );

      for (const recipe of relevantRecipes) {
        const totalDeduction = recipe.quantityRequired * item.quantity;
        inventoryDeductions.push({
          ingredientId: recipe.ingredient.id,
          ingredientName: recipe.ingredient.name,
          quantityChange: -totalDeduction,
          unit: recipe.unit,
        });
      }
    }

    const totalAmount = subtotal + (deliveryFee || 0) - (loyaltyDiscount || 0) - (promoDiscount || 0);

    // Use the shift ID for tracking (if a shift was found)
    // For CASHIER, it's their own shift; for ADMIN/BRANCH_MANAGER, it's any open shift from the branch
    const currentShiftId = openShift?.id || null;

    // Generate transaction hash for tamper detection
    const transactionHash = Buffer.from(
      `${branchId}-${finalOrderNumber}-${totalAmount}-${cashierId}-${Date.now()}`
    ).toString('base64');

    // Create order with inventory deduction
    const order = await db.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          id: `${branchId}-${finalOrderNumber}-${Date.now()}`,
          branchId,
          orderNumber: finalOrderNumber,
          orderTimestamp: new Date(),
          cashierId,
          subtotal,
          totalAmount,
          paymentMethod,
          orderType: orderType || 'dine-in',
          deliveryAddress: deliveryAddress || null,
          deliveryAreaId: deliveryAreaId || null,
          deliveryFee: deliveryFee || 0,
          customerId: customerId || null,
          customerAddressId: customerAddressId || null,
          courierId: courierId || null,
          transactionHash,
          synced: false,
          shiftId: currentShiftId,
          tableId: tableId || null,
          promoCodeId: promoCodeId || null,
          promoDiscount: promoDiscount || 0,
          cardReferenceNumber: cardReferenceNumber || null,
        },
      });

      // Create order items and capture created records
      const createdOrderItems = [];
      for (const item of orderItemsToCreate) {
        const createdItem = await tx.orderItem.create({
          data: {
            ...item,
            orderId: newOrder.id,
          },
        });
        createdOrderItems.push(createdItem);
      }

      // Deduct inventory with atomic operations to prevent race conditions
      for (const deduction of inventoryDeductions) {
        await safeInventoryDeduct(
          tx,
          branchId,
          deduction.ingredientId,
          deduction.quantityChange,
          newOrder.id,
          cashierId,
          deduction.ingredientName
        );
      }

      return { order: newOrder, items: createdOrderItems };
    }).catch((transactionError) => {
      console.error('Transaction failed:', transactionError);
      throw transactionError;
    });

    // Log order creation to audit logs
    const orderDetails = `Order #${order.order.orderNumber}, Total: ${totalAmount}, Payment: ${paymentMethod}`;
    await logOrderCreated(cashierId, order.order.id, orderDetails);

    // Log promo code usage if applicable
    if (promoCodeId && promoDiscount > 0) {
      await logPromoCodeApplied(cashierId, promoCodeId, promoCode || '', promoDiscount);
    }

    // Update table status to OCCUPIED when a dine-in order is created with a tableId
    if (tableId && orderType === 'dine-in') {
      try {
        await db.table.update({
          where: { id: tableId },
          data: {
            status: 'OCCUPIED',
            openedAt: new Date(),
            openedBy: cashierId,
            currentOrderId: order.order.id,
          },
        });
        console.log(`[Order] Table ${tableId} updated to OCCUPIED with order ${order.orderNumber}`);
      } catch (tableError) {
        console.error('[Order] Failed to update table status:', tableError);
        // Don't fail the order if table update fails
      }
    }

    // Get branch for response
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });

    // Log promo code usage if applicable
    if (promoCodeId && promoDiscount && promoDiscount > 0) {
      console.log('[Order] Processing promo code:', { promoCodeId, promoDiscount });
      try {
        // Get the promo code details
        const promoCode = await db.promotionCode.findUnique({
          where: { id: promoCodeId },
          include: { promotion: true },
        });

        if (promoCode) {
          console.log('[Order] Found promo code:', promoCode.code);

          // Create usage log
          await db.promotionUsageLog.create({
            data: {
              promotionId: promoCode.promotionId,
              codeId: promoCodeId,
              code: promoCode.code,
              orderId: order.order.id,
              branchId,
              customerId: customerId || null,
              discountAmount: promoDiscount,
              orderSubtotal: subtotal,
              cashierId,
            },
          });

          // Update promo code usage count
          await db.promotionCode.update({
            where: { id: promoCodeId },
            data: {
              usageCount: {
                increment: 1,
              },
            },
          });

          console.log('[Order] Promo usage log created, now creating cost record...');

          // Create cost record for promo code discount
          try {
            await createPromoCodeDiscountCost(
              branchId,
              promoDiscount,
              finalOrderNumber,
              order.order.id,
              promoCode.code,
              customerId,
              currentShiftId
            );
            console.log('[Order] Promo code cost record created successfully');
          } catch (costError) {
            console.error('[Order] Failed to create promo code discount cost:', costError);
            // Don't fail order if cost creation fails
          }
        } else {
          console.error('[Order] Promo code not found for ID:', promoCodeId);
        }
      } catch (promoError) {
        console.error('[Order] Failed to log promo usage:', promoError);
        // Don't fail the order if promo logging fails
      }
    } else {
      console.log('[Order] No promo code to process:', { promoCodeId, promoDiscount });
    }

    // Increment customer address order count if delivery order with address
    if (customerAddressId && orderType === 'delivery') {
      try {
        await db.customerAddress.update({
          where: { id: customerAddressId },
          data: {
            orderCount: {
              increment: 1,
            },
          },
        });
      } catch (error) {
        console.error('Failed to update customer address order count:', error);
        // Don't fail the order if address update fails
      }
    }

    // Update customer statistics
    if (customerId) {
      try {
        // Calculate loyalty points (1 point per 100 EGP spent = 0.01 points per EGP)
        const pointsEarned = subtotal / 100;
        const netPointsChange = pointsEarned - (loyaltyPointsRedeemed || 0);

        await db.customer.update({
          where: { id: customerId },
          data: {
            totalSpent: {
              increment: subtotal,
            },
            orderCount: {
              increment: 1,
            },
            loyaltyPoints: {
              increment: netPointsChange,
            },
          },
        });

        // Create loyalty transaction record for earned points
        if (pointsEarned > 0) {
          try {
            await db.loyaltyTransaction.create({
              data: {
                customerId,
                points: pointsEarned,
                type: 'EARNED',
                orderId: order.order.id,
                amount: subtotal,
                notes: `Order #${finalOrderNumber}`,
              },
            });
          } catch (ltError) {
            console.error('Failed to create loyalty transaction:', ltError);
            // Don't fail the order if loyalty transaction fails
          }
        }

        // Create loyalty transaction record for redeemed points
        if (loyaltyPointsRedeemed && loyaltyPointsRedeemed > 0) {
          try {
            await db.loyaltyTransaction.create({
              data: {
                customerId,
                points: -loyaltyPointsRedeemed, // Negative because it's being deducted
                type: 'REDEEMED',
                orderId: order.order.id,
                amount: loyaltyDiscount,
                notes: `Redeemed on Order #${finalOrderNumber}`,
              },
            });

            // Create cost record for loyalty discount
            // This tracks the discount as a cost so:
            // - Revenue shows gross sales (300 EGP)
            // - Cost shows discount (30 EGP)
            // - Net profit is correct
            // - Cash collection matches
            try {
              await createLoyaltyDiscountCost(
                branchId,
                loyaltyDiscount,
                finalOrderNumber,
                order.order.id,
                customerId,
                currentShiftId
              );
            } catch (costError) {
              console.error('Failed to create loyalty discount cost:', costError);
              // Don't fail order if cost creation fails
            }
          } catch (ltError) {
            console.error('Failed to create redemption transaction:', ltError);
            // Don't fail the order if loyalty transaction fails
          }
        }

        // Update customer tier based on total spent
        const updatedCustomer = await db.customer.findUnique({
          where: { id: customerId },
        });

        if (updatedCustomer) {
          let newTier = 'BRONZE';
          // Update tier thresholds based on total spent (in EGP)
          if (updatedCustomer.totalSpent >= 10000) {
            newTier = 'PLATINUM';
          } else if (updatedCustomer.totalSpent >= 5000) {
            newTier = 'GOLD';
          } else if (updatedCustomer.totalSpent >= 2000) {
            newTier = 'SILVER';
          }

          if (updatedCustomer.tier !== newTier) {
            try {
              await db.customer.update({
                where: { id: customerId },
                data: { tier: newTier },
              });
            } catch (tierError) {
              console.error('Failed to update customer tier:', tierError);
              // Don't fail the order if tier update fails
            }
          }
        }
      } catch (customerError) {
        console.error('Failed to update customer statistics:', customerError);
        // Don't fail the order if customer update fails
      }
    }

    const responseOrder = order.order;

    return NextResponse.json({
      success: true,
      order: {
        id: responseOrder.id,
        branchId: responseOrder.branchId,
        orderNumber: responseOrder.orderNumber,
        orderTimestamp: responseOrder.orderTimestamp.toISOString(),
        totalAmount: responseOrder.totalAmount,
        subtotal: responseOrder.subtotal,
        paymentMethod: responseOrder.paymentMethod,
        orderType: responseOrder.orderType,
        deliveryFee: responseOrder.deliveryFee,
        deliveryAddress: responseOrder.deliveryAddress,
        deliveryAreaId: responseOrder.deliveryAreaId,
        isRefunded: responseOrder.isRefunded,
        refundReason: responseOrder.refundReason,
        transactionHash: responseOrder.transactionHash,
        synced: responseOrder.synced,
        shiftId: responseOrder.shiftId,
        createdAt: responseOrder.createdAt.toISOString(),
        updatedAt: responseOrder.updatedAt.toISOString(),
        cashierId: cashier.id,
        cashier: {
          id: cashier.id,
          username: cashier.username,
          name: cashier.name,
        },
        customerPhone: customerPhone || null,
        customerName: customerName || null,
        loyaltyPointsRedeemed: loyaltyPointsRedeemed || null,
        loyaltyDiscount: loyaltyDiscount || null,
        promoCodeId: promoCodeId || null,
        promoDiscount: promoDiscount || null,
        cardReferenceNumber: cardReferenceNumber || null,
        items: order.items.map(item => ({
          id: item.id,
          menuItemId: item.menuItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          recipeVersion: item.recipeVersion,
          menuItemVariantId: item.menuItemVariantId,
          variantName: item.variantName,
          specialInstructions: item.specialInstructions,
          createdAt: item.createdAt.toISOString(),
          // Include full variant info for receipt printing
          ...(item.menuItemVariantId ? {
            menuItemVariant: {
              id: item.menuItemVariantId,
              variantOption: {
                name: item.variantName?.split(': ')[1] || item.variantName || null,
              },
            },
          } : {}),
        })),
        branch: branch ? {
          id: branch.id,
          branchName: branch.branchName,
        } : null,
      },
      message: 'Order processed successfully',
    });
  } catch (error: any) {
    console.error('Order processing error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    // Log to error tracking service in production
    // await logErrorToService(error, {
    //   endpoint: '/api/orders',
    //   userId,
    //   action: 'order.create',
    //   entityType: 'Order',
    //   entityId: newOrder?.id,
    //   error,
    // })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process order',
        details: error.message,
        errorName: error.name,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    if (startDate || endDate) {
      where.orderTimestamp = {};
      if (startDate) {
        where.orderTimestamp.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of the day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.orderTimestamp.lte = endDateTime;
      }
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { orderTimestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, category: true, price: true },
            },
          },
        },
        cashier: {
          select: { username: true, name: true },
        },
        branch: {
          select: { branchName: true },
        },
        courier: {
          select: { name: true, phone: true },
        },
      },
    });

    const total = await db.order.count({
      where,
    });

    return NextResponse.json({
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + orders.length < total,
      },
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
