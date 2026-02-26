import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCached, invalidateCache, invalidateCachePattern, cacheKeys } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');
    const includeVariants = searchParams.get('includeVariants') === 'true';
    const branchId = searchParams.get('branchId');

    // Generate cache key based on query parameters
    const cacheKey = `menu:items:${category || 'all'}:${active || 'all'}:${includeVariants ? 'variants' : 'no-variants'}:${branchId || 'all-branches'}`;

    const menuItems = await getCached(cacheKey, async () => {
      // Build where clause
      const whereClause: any = {
        ...(category && category !== 'all' ? { category } : {}),
        ...(active !== null ? { isActive: active === 'true' } : {}),
      };

      // If branchId is provided, filter menu items by branch
      // Items are available if they have NO branch assignments (all branches) OR have an assignment to this branch
      if (branchId) {
        // This is a complex filter - we'll get items and filter in code for simplicity
        // Or use a more sophisticated Prisma query
        const allMenuItems = await db.menuItem.findMany({
          where: whereClause,
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
          include: {
            branchAssignments: true,
            recipes: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    costPerUnit: true,
                    unit: true,
                  },
                },
              },
            },
            categoryRel: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
              },
            },
            ...(includeVariants ? {
              variants: {
                include: {
                  variantType: {
                    select: {
                      id: true,
                      name: true,
                      isCustomInput: true,
                    },
                  },
                  variantOption: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  recipes: {
                    include: {
                      ingredient: {
                        select: {
                          id: true,
                          name: true,
                          costPerUnit: true,
                          unit: true,
                        },
                      },
                    },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            } : {}),
          },
        });

        // Filter by branch: item is available if it has NO assignments OR has assignment to this branch
        return allMenuItems.filter(item => {
          // If no branch assignments, item is available to all branches
          if (!item.branchAssignments || item.branchAssignments.length === 0) {
            return true;
          }
          // If has assignments, check if any is for this branch
          return item.branchAssignments.some(ba => ba.branchId === branchId);
        });
      } else {
        // No branch filter, return all items
        return await db.menuItem.findMany({
          where: whereClause,
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
          include: {
            branchAssignments: true,
            recipes: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    costPerUnit: true,
                    unit: true,
                  },
                },
              },
            },
            categoryRel: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
              },
            },
            ...(includeVariants ? {
              variants: {
                include: {
                  variantType: {
                    select: {
                      id: true,
                      name: true,
                      isCustomInput: true,
                    },
                  },
                  variantOption: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  recipes: {
                    include: {
                      ingredient: {
                        select: {
                          id: true,
                          name: true,
                          costPerUnit: true,
                          unit: true,
                        },
                      },
                    },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            } : {}),
          },
        });
      }
    }, 300000); // 5 minute cache

    // Calculate dynamic product cost for each menu item and its variants
    const menuItemsWithCost = menuItems.map(item => {
      // Calculate base product cost (only from base recipes where menuItemVariantId is null)
      const baseProductCost = item.recipes.reduce((total, recipe) => {
        // Skip variant-specific recipes - only count base recipes
        if (recipe.menuItemVariantId !== null) {
          return total;
        }
        const ingredientCost = recipe.quantityRequired * recipe.ingredient.costPerUnit;
        return total + ingredientCost;
      }, 0);

      // Calculate profit and margin for base item (using base price)
      const profit = item.price - baseProductCost;
      const profitMargin = item.price > 0 ? (profit / item.price) * 100 : 0;

      // Calculate costs for each variant
      const variantsWithCost = item.variants?.map(variant => {
        // Use variant-specific recipes if available, otherwise fall back to base recipes
        const variantRecipes = variant.recipes && variant.recipes.length > 0
          ? variant.recipes
          : item.recipes;

        const variantProductCost = variantRecipes.reduce((total, recipe) => {
          const ingredientCost = recipe.quantityRequired * recipe.ingredient.costPerUnit;
          return total + ingredientCost;
        }, 0);

        const variantPrice = item.price + variant.priceModifier;
        const variantProfit = variantPrice - variantProductCost;
        const variantProfitMargin = variantPrice > 0 ? (variantProfit / variantPrice) * 100 : 0;

        return {
          ...variant,
          productCost: parseFloat(variantProductCost.toFixed(2)),
          profit: parseFloat(variantProfit.toFixed(2)),
          profitMargin: parseFloat(variantProfitMargin.toFixed(2)),
        };
      }) || [];

      // Extract branch IDs from assignments
      const assignedBranchIds = item.branchAssignments?.map(ba => ba.branchId) || [];
      const isAvailableToAllBranches = assignedBranchIds.length === 0;

      return {
        ...item,
        productCost: parseFloat(baseProductCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        variants: variantsWithCost,
        branchIds: assignedBranchIds,
        availableToAllBranches: isAvailableToAllBranches,
      };
    });

    return NextResponse.json({ menuItems: menuItemsWithCost });
  } catch (error: any) {
    console.error('Get menu items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a PATCH override for updates
    if (body._method === 'PATCH') {
      return await handleUpdate(body);
    }

    // Original POST logic for creating new items
    const { name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants, branchIds, imagePath } = body;

    if (!name || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price' },
        { status: 400 }
      );
    }

    // Validate categoryId if provided
    let validCategoryId = null;
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
      validCategoryId = categoryId;
    }

    // Validate branchIds if provided
    let validBranchIds: string[] = [];
    if (branchIds && Array.isArray(branchIds) && branchIds.length > 0) {
      // Check if "all" is selected (special case)
      if (!branchIds.includes('all')) {
        // Validate each branch ID
        const branches = await db.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true },
        });
        validBranchIds = branches.map(b => b.id);
      }
      // If "all" is in the array, we leave validBranchIds empty (means available to all)
    }

    // Create menu item
    const menuItem = await db.menuItem.create({
      data: {
        name,
        category: category || 'Other',
        categoryId: validCategoryId,
        price: parseFloat(price),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 0.14,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder !== undefined && sortOrder !== '' ? parseInt(sortOrder) : null,
        hasVariants: hasVariants !== undefined ? hasVariants : false,
        imagePath: imagePath || null,
      },
    });

    // Create branch assignments if specific branches are selected
    if (validBranchIds.length > 0) {
      await db.menuItemBranch.createMany({
        data: validBranchIds.map(branchId => ({
          menuItemId: menuItem.id,
          branchId,
        })),
        skipDuplicates: true,
      });
    }

    // Invalidate menu items cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      menuItem,
    });
  } catch (error: any) {
    console.error('Menu item POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process menu item request', details: error.message },
      { status: 500 }
    );
  }
}

async function handleUpdate(body: any) {
  const { id, name, category, categoryId, price, taxRate, isActive, sortOrder, hasVariants, branchIds, imagePath } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Menu item ID is required' },
      { status: 400 }
    );
  }

  // Check if menu item exists
  const existingItem = await db.menuItem.findUnique({
    where: { id },
  });

  if (!existingItem) {
    return NextResponse.json(
      { error: 'Menu item not found' },
      { status: 404 }
    );
  }

  // Validate categoryId if provided and not empty
  if (categoryId && categoryId.trim() !== '') {
    const cat = await db.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }
  }

  // Build update data with proper validation
  const updateData: any = {};
  if (name && name.trim() !== '') updateData.name = name.trim();
  if (category && category.trim() !== '') updateData.category = category.trim();
  if (categoryId && categoryId.trim() !== '') updateData.categoryId = categoryId.trim();
  if (price !== undefined && price !== '' && !isNaN(parseFloat(price))) {
    updateData.price = parseFloat(price);
  }
  if (taxRate !== undefined && taxRate !== '' && !isNaN(parseFloat(taxRate))) {
    updateData.taxRate = parseFloat(taxRate);
  }
  if (isActive !== undefined) updateData.isActive = isActive;
  if (sortOrder !== undefined && sortOrder !== '' && !isNaN(parseInt(sortOrder))) {
    updateData.sortOrder = parseInt(sortOrder);
  }
  if (hasVariants !== undefined) updateData.hasVariants = hasVariants;
  if (imagePath !== undefined) updateData.imagePath = imagePath;

  // Update menu item
  const menuItem = await db.menuItem.update({
    where: { id },
    data: updateData,
  });

  // Handle branch assignments if provided
  if (branchIds !== undefined) {
    // Delete existing branch assignments
    await db.menuItemBranch.deleteMany({
      where: { menuItemId: id },
    });

    // Create new assignments if specific branches are selected
    if (branchIds && Array.isArray(branchIds) && branchIds.length > 0 && !branchIds.includes('all')) {
      // Validate branch IDs
      const branches = await db.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true },
      });
      
      const validBranchIds = branches.map(b => b.id);
      
      if (validBranchIds.length > 0) {
        await db.menuItemBranch.createMany({
          data: validBranchIds.map(branchId => ({
            menuItemId: id,
            branchId,
          })),
          skipDuplicates: true,
        });
      }
    }
    // If branchIds is empty or contains "all", don't create any assignments (available to all)
  }

  // Invalidate menu items cache
  invalidateCachePattern('^menu:items:');

  return NextResponse.json({
    success: true,
    menuItem,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    return await handleUpdate(body);
  } catch (error: any) {
    console.error('Update menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Menu item ID is required' },
        { status: 400 }
      );
    }

    // Check if menu item exists
    const existingItem = await db.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Delete menu item (will cascade to order items and recipes and branch assignments)
    await db.menuItem.delete({
      where: { id },
    });

    // Invalidate menu items cache
    invalidateCachePattern('^menu:items:');

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}
